'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  getCompanyProfile,
  listPartners,
  listArticles,
} from '@/src/features/invoicing/actions';
import {
  createInvoiceDraft,
  updateInvoiceDraft,
  finalizeInvoice,
  getInvoice,
  getInvoiceLines,
  getNextNumber,
} from '@/src/features/bulgarian-invoicing/actions';
import type { RecipientInput, LineItemWithArticle } from '@/src/features/bulgarian-invoicing/actions';
import { calculateInvoice, amountInWordsBg } from '@/src/features/bulgarian-invoicing';
import type { PartySnapshot, BgVatRate } from '@/src/features/bulgarian-invoicing/types';
import { parseBgVatRate, parseDocType } from '@/src/features/bulgarian-invoicing/parsers';
import type { Company } from '@/lib/db/schema';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { requireStringParam } from '@/lib/route-params';
import { RecipientCard } from './_components/RecipientCard';
import { DocumentCard } from './_components/DocumentCard';
import { LineItemsCard } from './_components/LineItemsCard';
import { TotalsCard } from './_components/TotalsCard';
import { PaymentCard } from './_components/PaymentCard';
import { NotesCard } from './_components/NotesCard';
import { ActionsBar } from './_components/ActionsBar';
import { useInvoiceForm } from './_components/use-invoice-form';
import { Alert } from '@/components/ui/alert';
import { makeInitialFormState } from './_components/form-state';
import { invoiceToFormState, invoiceToCopyFormState } from './_components/hydrate';
import { PageShell } from '@/components/page-shell';

function buildSupplierSnapshot(profile: Company): PartySnapshot {
  const address = [profile.street, [profile.postCode, profile.city].filter(Boolean).join(' '), profile.country].filter(Boolean).join(', ');
  return {
    legalName: profile.legalName,
    address,
    uic: profile.eik,
    vatNumber: profile.vatNumber ?? null,
  };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');
  const editId = searchParams.get('edit') ? Number(searchParams.get('edit')) : null;
  // ?copy=<id> — hydrate a fresh draft from an existing invoice (any status).
  const copyId =
    editId === null && searchParams.get('copy')
      ? Number(searchParams.get('copy'))
      : null;
  const sourceId = editId ?? copyId;

  const [draftId, setDraftId] = useState<number | null>(editId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([]);

  const { data: companyProfile, isLoading: profileLoading } = useActionSWR(
    'companyProfile',
    getCompanyProfile
  );
  const { data: partnersList, isLoading: partnersLoading } = useActionSWR(
    ['partners', 'invoice-form'],
    () => listPartners({ page: 1, pageSize: 500 })
  );
  const { data: articlesList, isLoading: articlesLoading } = useActionSWR(
    ['articles', 'invoice-form'],
    () => listArticles({ page: 1, pageSize: 500 })
  );
  const { data: nextInvoiceNumber } = useActionSWR(
    editId ? null : 'nextInvoiceNumber',
    getNextNumber
  );
  const { data: editingInvoice, isLoading: invoiceLoading } = useActionSWR(
    sourceId ? ['invoice', sourceId] : null,
    () => {
      if (sourceId == null) throw new Error('unreachable: sourceId null with non-null key');
      return getInvoice(sourceId);
    }
  );
  const { data: editingLines, isLoading: linesLoading } = useActionSWR(
    sourceId ? ['invoiceLines', sourceId] : null,
    () => {
      if (sourceId == null) throw new Error('unreachable: sourceId null with non-null key');
      return getInvoiceLines(sourceId);
    }
  );

  const partners = partnersList?.items ?? [];
  const articles = articlesList?.items ?? [];

  const form = useInvoiceForm(makeInitialFormState());
  const { state, update, updateRecipient, addLine, updateLine, removeLine, hydrate } = form;

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!sourceId || hydratedRef.current) return;
    if (!editingInvoice || !editingLines || !partnersList) return;

    if (editId) {
      // EDIT-RULE: editable until accounted; cancelled must be reinstated first.
      if (editingInvoice.accountingStatus === 'accounted') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setError(
          'Тази фактура е маркирана като осчетоводена и е заключена. Върнете я към чакащо осчетоводяване, за да я редактирате.'
        );
        hydratedRef.current = true;
        return;
      }
      if (editingInvoice.status === 'cancelled') {
        setError(
          'Тази фактура е анулирана. Възстановете я от списъка с фактури, преди да я редактирате.'
        );
        hydratedRef.current = true;
        return;
      }
      hydrate(invoiceToFormState(editingInvoice, editingLines, partnersList.items));
    } else {
      // Copy: any status is a valid source; the result is a fresh unsaved draft.
      hydrate(invoiceToCopyFormState(editingInvoice, editingLines, partnersList.items));
    }
    hydratedRef.current = true;
  }, [sourceId, editId, editingInvoice, editingLines, partnersList, hydrate]);

  const loading =
    profileLoading ||
    partnersLoading ||
    articlesLoading ||
    (sourceId !== null && (invoiceLoading || linesLoading));

  const isVatRegistered = companyProfile?.isVatRegistered ?? true;
  const defaultVatRate = parseBgVatRate(companyProfile?.defaultVatRate);
  const effectiveVatRate: BgVatRate =
    !isVatRegistered || state.vatMode === 'no_vat' ? 0 : defaultVatRate;

  const itemsWithVatForCalc = state.lineItems.map((item) => ({
    ...item,
    vatRate: effectiveVatRate,
  }));
  const { totals } = calculateInvoice(itemsWithVatForCalc);

  const handlePartnerSelect = (id: number | '') => {
    if (id === '') {
      form.selectPartner(null);
      return;
    }
    const p = partners.find((x) => x.id === id);
    form.selectPartner(p ?? null);
  };

  const buildPayload = () => {
    const itemsWithVat: LineItemWithArticle[] = state.lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      vatRate: effectiveVatRate,
      discountPercent: item.discountPercent,
      articleId: item.articleId,
    }));
    const recipientInput: RecipientInput = {
      partnerId: state.selectedPartnerId || undefined,
      name: state.recipient.name,
      eik: state.recipient.eik,
      vatNumber: state.recipient.vatNumber || null,
      country: state.recipient.country || 'BG',
      city: state.recipient.city,
      street: state.recipient.street,
      postCode: state.recipient.postCode || null,
      mol: state.recipient.mol || null,
    };
    return {
      docType: state.docType,
      issueDate: state.issueDate,
      supplyDate: state.supplyDate || null,
      currency: state.currency,
      fxRate: state.fxRate,
      recipient: recipientInput,
      lineItems: itemsWithVat,
      language: state.language,
      paymentMethod: state.paymentMethod,
      paymentStatus: state.paymentStatus,
      dueDate: state.dueDate || null,
      vatMode: state.vatMode,
      noVatReason: state.vatMode === 'no_vat' ? state.noVatReason : null,
      amountInWords:
        state.amountInWordsOverride.trim() || amountInWordsBg(totals.grossAmount, state.currency),
      customerNote: state.customerNote.trim() || null,
      internalComment: state.internalComment.trim() || null,
    };
  };

  const surfaceFailure = (res: {
    error?: string;
    validationErrors?: { field: string; message: string }[];
  }) => {
    setError(res.error ?? null);
    if (res.validationErrors)
      setValidationErrors(res.validationErrors.map((e) => ({ field: e.field, message: e.message })));
  };

  /** Persist the current form as a draft. Returns the draft id, or null on failure. */
  const saveDraft = async (): Promise<number | null> => {
    if (!companyProfile) {
      setError('Профилът на фирмата (Доставчик) е задължителен. Попълнете го в Настройки.');
      return null;
    }
    setSaving(true);
    setError(null);
    setValidationErrors([]);
    const payload = buildPayload();
    if (draftId) {
      const res = await updateInvoiceDraft(draftId, payload);
      setSaving(false);
      if (res.error || !res.data) {
        surfaceFailure(res);
        return null;
      }
      setDraftId(res.data.id);
      return res.data.id;
    }
    const supplier = buildSupplierSnapshot(companyProfile);
    const res = await createInvoiceDraft({ ...payload, supplier });
    setSaving(false);
    if (res.error || !res.data) {
      surfaceFailure(res);
      return null;
    }
    setDraftId(res.data.id);
    router.replace(`/c/${companyId}/invoices/new?edit=${res.data.id}`);
    return res.data.id;
  };

  const handleSaveDraft = async () => {
    await saveDraft();
  };

  const handleFinalize = async () => {
    if (!companyProfile) {
      setError('Профилът на фирмата (Доставчик) е задължителен. Попълнете го в Настройки.');
      return;
    }
    setSaving(true);
    setError(null);
    setValidationErrors([]);
    if (draftId) {
      // A saved draft first gets the latest form state, then finalizes.
      const savedId = await saveDraft();
      if (!savedId) return;
      setSaving(true);
      const res = await finalizeInvoice(savedId);
      setSaving(false);
      if (res.error || !res.data) {
        surfaceFailure(res);
        return;
      }
      router.push(`/c/${companyId}/invoices/${res.data.id}`);
      return;
    }
    // NI-1: no draft yet — create + finalize in one server transaction.
    const supplier = buildSupplierSnapshot(companyProfile);
    const res = await createInvoiceDraft({
      ...buildPayload(),
      supplier,
      finalizeImmediately: true,
    });
    setSaving(false);
    if (res.error || !res.data) {
      surfaceFailure(res);
      return;
    }
    router.push(`/c/${companyId}/invoices/${res.data.id}`);
  };

  if (loading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="4xl" className="mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild aria-label="Назад към фактурите">
          <Link href={`/c/${companyId}/invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg lg:text-2xl font-medium">
          {draftId ? 'Редактиране на фактура' : 'Нова фактура'}
        </h1>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}
      {validationErrors.length > 0 && (
        <ul className="mb-4 list-disc list-inside text-sm text-red-700">
          {validationErrors.map((e, i) => (
            <li key={i}>{e.field}: {e.message}</li>
          ))}
        </ul>
      )}

      <RecipientCard
        partners={partners}
        selectedPartnerId={state.selectedPartnerId}
        recipient={state.recipient}
        onPartnerSelect={handlePartnerSelect}
        onRecipientChange={updateRecipient}
      />

      <DocumentCard
        docType={state.docType}
        onDocTypeChange={(v) => update({ docType: parseDocType(v) })}
        isEditing={Boolean(editId)}
        nextInvoiceNumber={nextInvoiceNumber ?? null}
        issueDate={state.issueDate}
        onIssueDateChange={(v) => update({ issueDate: v })}
        supplyDate={state.supplyDate}
        onSupplyDateChange={(v) => update({ supplyDate: v })}
        language={state.language}
        onLanguageChange={(v) => update({ language: v })}
        currency={state.currency}
        onCurrencyChange={(v) => update({ currency: v })}
      />

      <LineItemsCard
        lineItems={state.lineItems}
        articles={articles}
        isVatRegistered={isVatRegistered}
        defaultVatRate={defaultVatRate}
        effectiveVatRate={effectiveVatRate}
        vatMode={state.vatMode}
        onVatModeChange={(v) => update({ vatMode: v })}
        noVatReason={state.noVatReason}
        onNoVatReasonChange={(v) => update({ noVatReason: v })}
        onUpdateLine={updateLine}
        onAddLine={() => addLine(effectiveVatRate)}
        onRemoveLine={removeLine}
      />

      <TotalsCard
        totals={totals}
        currency={state.currency}
        amountInWordsOverride={state.amountInWordsOverride}
        onAmountInWordsOverrideChange={(v) => update({ amountInWordsOverride: v })}
      />

      <PaymentCard
        paymentMethod={state.paymentMethod}
        onPaymentMethodChange={(v) => update({ paymentMethod: v })}
        companyProfile={companyProfile ?? null}
        dueDate={state.dueDate}
        onDueDateChange={(v) => update({ dueDate: v })}
        paymentStatus={state.paymentStatus}
        onPaymentStatusChange={(v) => update({ paymentStatus: v })}
      />

      <NotesCard
        internalComment={state.internalComment}
        onInternalCommentChange={(v) => update({ internalComment: v })}
      />

      <ActionsBar
        saving={saving}
        onSaveDraft={handleSaveDraft}
        onFinalize={handleFinalize}
      />
    </PageShell>
  );
}

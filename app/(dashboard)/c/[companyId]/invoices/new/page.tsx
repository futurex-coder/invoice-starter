'use client';

import { useState, useEffect, useCallback } from 'react';
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
import type { PartySnapshot, LineItemInput, BgVatRate } from '@/src/features/bulgarian-invoicing/types';
import type { Company, Partner, Article } from '@/lib/db/schema';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { RecipientCard } from './_components/RecipientCard';
import { DocumentCard } from './_components/DocumentCard';
import { LineItemsCard } from './_components/LineItemsCard';
import { TotalsCard } from './_components/TotalsCard';
import { PaymentCard } from './_components/PaymentCard';
import { NotesCard } from './_components/NotesCard';
import { ActionsBar } from './_components/ActionsBar';
import {
  emptyRecipient,
  defaultLineItem,
  type RecipientForm,
  type LineItemForm,
  type VatMode,
  type PaymentMethod,
} from './_components/types';

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
  const companyId = params.companyId as string;
  const editId = searchParams.get('edit') ? Number(searchParams.get('edit')) : null;

  const [companyProfile, setCompanyProfile] = useState<Company | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([]);

  // Form state
  const [recipient, setRecipient] = useState<RecipientForm>(emptyRecipient);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | ''>('');
  const [docType, setDocType] = useState<string>('invoice');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplyDate, setSupplyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [language, setLanguage] = useState('bg');
  const [currency, setCurrency] = useState('EUR');
  const [fxRate, setFxRate] = useState(1);
  const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...defaultLineItem }]);
  const [vatMode, setVatMode] = useState<VatMode>('standard');
  const [noVatReason, setNoVatReason] = useState('');
  const [amountInWordsOverride, setAmountInWordsOverride] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank');
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [dueDate, setDueDate] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [internalComment, setInternalComment] = useState('');
  const [draftId, setDraftId] = useState<number | null>(editId);

  const isVatRegistered = companyProfile?.isVatRegistered ?? true;
  const defaultVatRate = (companyProfile?.defaultVatRate ?? 20) as BgVatRate;
  const effectiveVatRate: BgVatRate = !isVatRegistered || vatMode === 'no_vat' ? 0 : defaultVatRate;

  const recalc = useCallback(() => {
    const itemsWithVat = lineItems.map((item) => ({
      ...item,
      vatRate: effectiveVatRate,
    }));
    return calculateInvoice(itemsWithVat);
  }, [lineItems, effectiveVatRate]);

  const { totals } = recalc();

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [profileRes, partnersRes, articlesRes, nextNumRes] = await Promise.all([
      getCompanyProfile(),
      listPartners({ page: 1, pageSize: 500 }),
      listArticles({ page: 1, pageSize: 500 }),
      getNextNumber(),
    ]);
    if (profileRes.data) setCompanyProfile(profileRes.data);
    if (partnersRes.data) setPartners(partnersRes.data.items);
    if (articlesRes.data) setArticles(articlesRes.data.items);
    if (nextNumRes.data != null) setNextInvoiceNumber(nextNumRes.data);
    if (editId) {
      const invRes = await getInvoice(editId);
      if (invRes.error || !invRes.data) {
        setError(invRes.error ?? 'Invoice not found');
        setLoading(false);
        return;
      }
      const inv = invRes.data;
      if (inv.status !== 'draft') {
        setError('Only drafts can be edited');
        setLoading(false);
        return;
      }
      setDraftId(inv.id);

      if (inv.partnerId) {
        setSelectedPartnerId(inv.partnerId);
        const partner = partnersRes.data?.items.find((p) => p.id === inv.partnerId);
        if (partner) {
          setRecipient({
            name: partner.name,
            eik: partner.eik,
            vatNumber: partner.vatNumber ?? '',
            country: partner.country,
            city: partner.city,
            street: partner.street,
            postCode: partner.postCode ?? '',
            mol: partner.mol ?? '',
          });
        }
      } else {
        const rec = (inv.recipientSnapshot ?? {}) as PartySnapshot;
        setRecipient({
          name: rec.legalName ?? '',
          eik: rec.uic ?? '',
          vatNumber: rec.vatNumber ?? '',
          country: 'BG',
          city: '',
          street: rec.address ?? '',
          postCode: '',
          mol: '',
        });
      }

      setDocType(inv.docType ?? 'invoice');
      setIssueDate(inv.issueDate);
      setSupplyDate(inv.supplyDate ?? inv.issueDate);
      setLanguage(inv.language ?? 'bg');
      setCurrency(inv.currency ?? 'EUR');
      setFxRate(Number(inv.fxRate ?? 1));

      const linesRes = await getInvoiceLines(editId);
      const dbLines = linesRes.data ?? [];
      if (dbLines.length > 0) {
        setLineItems(
          dbLines.map((l) => ({
            description: l.description,
            quantity: Number(l.quantity),
            unit: l.unit,
            unitPrice: Number(l.unitPrice),
            vatRate: (l.vatRate ?? 20) as BgVatRate,
            discountPercent: Number(l.discountPercent ?? 0),
            articleId: l.articleId ?? null,
          }))
        );
      } else {
        const items = (inv.items ?? []) as Array<LineItemInput & { sortOrder?: number }>;
        setLineItems(
          items.length
            ? items.map((i) => ({
                description: i.description,
                quantity: i.quantity,
                unit: i.unit,
                unitPrice: i.unitPrice,
                vatRate: (i.vatRate ?? 20),
                discountPercent: i.discountPercent ?? 0,
                articleId: null,
              }))
            : [{ ...defaultLineItem }]
        );
      }

      setVatMode((inv.vatMode as VatMode) ?? 'standard');
      setNoVatReason(inv.noVatReason ?? '');
      setAmountInWordsOverride('');
      setPaymentMethod((inv.paymentMethod as PaymentMethod) ?? 'bank');
      setPaymentStatus(inv.paymentStatus ?? 'unpaid');
      setDueDate(inv.dueDate ?? '');
      setCustomerNote(inv.customerNote ?? '');
      setInternalComment(inv.internalComment ?? '');
    }
    setLoading(false);
  }, [editId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitial(); // async data fetch — setState calls are intentional side effects
  }, [loadInitial]);

  const handlePartnerSelect = (id: number | '') => {
    setSelectedPartnerId(id);
    if (id === '') {
      setRecipient(emptyRecipient);
      return;
    }
    const p = partners.find((x) => x.id === id);
    if (p) {
      setRecipient({
        name: p.name,
        eik: p.eik,
        vatNumber: p.vatNumber ?? '',
        country: p.country,
        city: p.city,
        street: p.street,
        postCode: p.postCode ?? '',
        mol: p.mol ?? '',
      });
    }
  };

  const handleRecipientChange = (patch: Partial<RecipientForm>) => {
    setRecipient((r) => ({ ...r, ...patch }));
  };

  const handleSaveDraft = async () => {
    if (!companyProfile) {
      setError('Company profile (Supplier) is required. Complete it in Settings.');
      return;
    }
    setSaving(true);
    setError(null);
    setValidationErrors([]);
    const supplier = buildSupplierSnapshot(companyProfile);
    const itemsWithVat: LineItemWithArticle[] = lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      vatRate: effectiveVatRate,
      discountPercent: item.discountPercent,
      articleId: item.articleId,
    }));
    const recipientInput: RecipientInput = {
      partnerId: selectedPartnerId || undefined,
      name: recipient.name,
      eik: recipient.eik,
      vatNumber: recipient.vatNumber || null,
      country: recipient.country || 'BG',
      city: recipient.city,
      street: recipient.street,
      postCode: recipient.postCode || null,
      mol: recipient.mol || null,
    };
    const payload = {
      docType: docType as 'invoice' | 'proforma' | 'credit_note' | 'debit_note',
      issueDate,
      supplyDate: supplyDate || null,
      currency,
      fxRate,
      recipient: recipientInput,
      lineItems: itemsWithVat,
      language,
      paymentMethod,
      paymentStatus,
      dueDate: dueDate || null,
      vatMode,
      noVatReason: vatMode === 'no_vat' ? noVatReason : null,
      amountInWords: amountInWordsOverride.trim() || amountInWordsBg(totals.grossAmount, currency),
      customerNote: customerNote.trim() || null,
      internalComment: internalComment.trim() || null,
    };
    if (draftId) {
      const res = await updateInvoiceDraft(draftId, payload);
      setSaving(false);
      if (res.error) {
        setError(res.error);
        if (res.validationErrors) setValidationErrors(res.validationErrors.map((e) => ({ field: e.field, message: e.message })));
        return;
      }
      if (res.data) setDraftId(res.data.id);
    } else {
      const res = await createInvoiceDraft({ ...payload, supplier });
      setSaving(false);
      if (res.error) {
        setError(res.error);
        if (res.validationErrors) setValidationErrors(res.validationErrors.map((e) => ({ field: e.field, message: e.message })));
        return;
      }
      if (res.data) {
        setDraftId(res.data.id);
        router.replace(`/c/${companyId}/invoices/new?edit=${res.data.id}`);
      }
    }
  };

  const handleFinalize = async () => {
    if (!draftId) {
      setError('Save draft first.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await finalizeInvoice(draftId);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) router.push(`/c/${companyId}/invoices/${res.data.id}`);
  };

  const handlePreview = () => {
    if (draftId) router.push(`/c/${companyId}/invoices/${draftId}?print=1`);
    else setError('Save draft first to preview.');
  };

  const addLine = () => {
    setLineItems((prev) => [...prev, { ...defaultLineItem, vatRate: effectiveVatRate }]);
  };

  const updateLine = (index: number, patch: Partial<LineItemForm>) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeLine = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <section className="flex-1 p-4 lg:p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/c/${companyId}/invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg lg:text-2xl font-medium">
          {draftId ? 'Edit draft invoice' : 'New invoice'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
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
        selectedPartnerId={selectedPartnerId}
        recipient={recipient}
        onPartnerSelect={handlePartnerSelect}
        onRecipientChange={handleRecipientChange}
      />

      <DocumentCard
        docType={docType}
        onDocTypeChange={setDocType}
        isEditing={Boolean(editId)}
        nextInvoiceNumber={nextInvoiceNumber}
        issueDate={issueDate}
        onIssueDateChange={setIssueDate}
        supplyDate={supplyDate}
        onSupplyDateChange={setSupplyDate}
        language={language}
        onLanguageChange={setLanguage}
        currency={currency}
        onCurrencyChange={setCurrency}
        fxRate={fxRate}
        onFxRateChange={setFxRate}
      />

      <LineItemsCard
        lineItems={lineItems}
        articles={articles}
        isVatRegistered={isVatRegistered}
        defaultVatRate={defaultVatRate}
        effectiveVatRate={effectiveVatRate}
        vatMode={vatMode}
        onVatModeChange={setVatMode}
        noVatReason={noVatReason}
        onNoVatReasonChange={setNoVatReason}
        onUpdateLine={updateLine}
        onAddLine={addLine}
        onRemoveLine={removeLine}
      />

      <TotalsCard
        totals={totals}
        currency={currency}
        amountInWordsOverride={amountInWordsOverride}
        onAmountInWordsOverrideChange={setAmountInWordsOverride}
      />

      <PaymentCard
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
        companyProfile={companyProfile}
        dueDate={dueDate}
        onDueDateChange={setDueDate}
        paymentStatus={paymentStatus}
        onPaymentStatusChange={setPaymentStatus}
      />

      <NotesCard
        customerNote={customerNote}
        onCustomerNoteChange={setCustomerNote}
        internalComment={internalComment}
        onInternalCommentChange={setInternalComment}
      />

      <ActionsBar
        saving={saving}
        hasDraft={Boolean(draftId)}
        onSaveDraft={handleSaveDraft}
        onPreview={handlePreview}
        onFinalize={handleFinalize}
      />
    </section>
  );
}

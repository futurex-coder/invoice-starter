'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getReceivedInvoice,
  updateReceivedInvoiceDraft,
  confirmReceivedInvoice,
  discardReceivedInvoice,
} from '@/src/features/received-invoices/actions';
import type {
  DuplicateMatch,
  ReceivedInvoiceReviewInput,
} from '@/src/features/received-invoices/types';
import {
  parseAccountingStatus,
  parsePaymentMethod,
  parsePaymentStatus,
  parseSupplierSnapshot,
} from '@/src/features/received-invoices/parsers';
import { parseBgVatRate } from '@/src/features/bulgarian-invoicing/parsers';
import {
  ExtractedInvoiceSchema,
  type ExtractedInvoice,
} from '@/app/api/invoices/extract/schema';
import { ReviewForm } from '@/components/received-invoices/ReviewForm';
import { PreviewPane } from '@/components/received-invoices/PreviewPane';
import { StatusBadge } from '@/components/received-invoices/StatusBadge';
import type {
  ReceivedInvoice,
  ReceivedInvoiceLine,
} from '@/lib/db/schema';

interface LoadedState {
  row: ReceivedInvoice;
  lines: ReceivedInvoiceLine[];
  partnerSuggestion:
    | { matchedPartnerId: number; matchedPartnerName: string }
    | null;
  fileSignedUrl: string;
  nextPendingId: number | null;
  pendingPosition: { index: number; total: number } | null;
}

function rowToReviewInput(
  row: ReceivedInvoice,
  lines: ReceivedInvoiceLine[]
): ReceivedInvoiceReviewInput {
  return {
    partnerId: row.partnerId,
    supplier: parseSupplierSnapshot(row.supplierSnapshot),
    createPartnerOnConfirm: !row.partnerId,
    invoiceNumber: row.invoiceNumber,
    issueDate: row.issueDate,
    supplyDate: row.supplyDate,
    dueDate: row.dueDate,
    currency: row.currency,
    fxRate: Number(row.fxRate),
    paymentMethod: parsePaymentMethod(row.paymentMethod),
    paymentStatus: parsePaymentStatus(row.paymentStatus),
    accountingStatus: parseAccountingStatus(row.accountingStatus),
    lineItems: lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitPrice: Number(l.unitPrice),
      vatRate: parseBgVatRate(l.vatRate),
      discountPercent: Number(l.discountPercent),
    })),
    notes: row.notes,
  };
}

export default function ReviewReceivedInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;
  const id = Number(params.id);

  const [state, setState] = useState<LoadedState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getReceivedInvoice(id);
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error ?? 'Could not load invoice');
      return;
    }
    setState(res.data);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleSaveDraft = async (patch: ReceivedInvoiceReviewInput) => {
    setSaving(true);
    setActionMessage(null);
    const res = await updateReceivedInvoiceDraft(id, patch);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setError(null);
    setDuplicates(res.data?.duplicates ?? []);
    setActionMessage('Draft saved.');
  };

  const handleConfirm = async (patch: ReceivedInvoiceReviewInput) => {
    setSaving(true);
    setActionMessage(null);
    const res = await confirmReceivedInvoice(id, patch);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (state?.nextPendingId) {
      router.push(
        `/c/${companyId}/received-invoices/review/${state.nextPendingId}`
      );
    } else {
      router.push(`/c/${companyId}/received-invoices`);
    }
  };

  const handleDiscard = async () => {
    if (!confirm('Discard this draft? It will not count in any totals.')) {
      return;
    }
    setSaving(true);
    const res = await discardReceivedInvoice(id);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (state?.nextPendingId) {
      router.push(
        `/c/${companyId}/received-invoices/review/${state.nextPendingId}`
      );
    } else {
      router.push(`/c/${companyId}/received-invoices`);
    }
  };

  if (loading) {
    return (
      <section className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  if (error && !state) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
        <Button variant="outline" asChild>
          <Link href={`/c/${companyId}/received-invoices`}>← Back to list</Link>
        </Button>
      </section>
    );
  }

  if (!state) return null;

  const initial = rowToReviewInput(state.row, state.lines);
  const rawExtractionParsed = ExtractedInvoiceSchema.safeParse(
    state.row.rawExtraction
  );
  const rawExtraction: ExtractedInvoice | null = rawExtractionParsed.success
    ? rawExtractionParsed.data
    : null;

  return (
    <section className="flex-1 p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/c/${companyId}/received-invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-medium lg:text-xl">
          Review received invoice
        </h1>
        <StatusBadge variant="lifecycle" value={state.row.status} />
        {state.row.extractionConfidence && (
          <StatusBadge
            variant="confidence"
            value={state.row.extractionConfidence}
          />
        )}
        {state.pendingPosition && (
          <span className="ml-auto text-sm text-gray-500">
            {state.pendingPosition.index} of {state.pendingPosition.total}{' '}
            pending
            {state.nextPendingId && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-2"
                onClick={() =>
                  router.push(
                    `/c/${companyId}/received-invoices/review/${state.nextPendingId}`
                  )
                }
              >
                Skip
                <ChevronRight className="ml-1 h-3 w-3" />
              </Button>
            )}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {actionMessage && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          {actionMessage}
        </div>
      )}
      {duplicates.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="flex-1">
            <p className="font-medium text-amber-900">
              Possible duplicate of another received invoice
              {duplicates.length > 1 ? 's' : ''}:
            </p>
            <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
              {duplicates.map((d) => (
                <li key={d.id}>
                  <Link
                    href={`/c/${companyId}/received-invoices/${d.id}`}
                    className="underline"
                    target="_blank"
                  >
                    #{d.id}
                  </Link>{' '}
                  {d.invoiceNumber ? `(№ ${d.invoiceNumber})` : ''}{' '}
                  {d.issueDate ?? ''}
                  {' — '}
                  <span className="text-amber-700">{d.matchType === 'checksum' ? 'same file' : 'same number + date'}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-amber-700">
              You can still continue if this is intentional.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
          <PreviewPane
            receivedInvoiceId={id}
            fileMimeType={state.row.fileMimeType}
            fileOriginalName={state.row.fileOriginalName}
            initialSignedUrl={state.fileSignedUrl}
          />
        </div>
        <div>
          <ReviewForm
            initial={initial}
            extractionConfidence={state.row.extractionConfidence}
            rawExtraction={rawExtraction}
            partnerSuggestion={state.partnerSuggestion}
            onSaveDraft={handleSaveDraft}
            onConfirm={handleConfirm}
            onDiscard={handleDiscard}
            saving={saving}
          />
        </div>
      </div>
    </section>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
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
import { requireStringParam } from '@/lib/route-params';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import {
  ExtractedInvoiceSchema,
  type ExtractedInvoice,
} from '@/app/api/invoices/extract/schema';
import { ReviewForm } from '@/components/received-invoices/ReviewForm';
import { PreviewPane } from '@/components/received-invoices/PreviewPane';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { toast } from '@/lib/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ReviewHeader } from './_components/ReviewHeader';
import { DuplicatesWarning } from './_components/DuplicatesWarning';
import { rowToReviewInput } from './_components/rowToReviewInput';
import { PageShell } from '@/components/page-shell';

export default function ReviewReceivedInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');
  const id = Number(params.id);

  const {
    data: state,
    isLoading: loading,
    error: fetchError,
  } = useActionSWR(['receivedInvoice', id], () => getReceivedInvoice(id));

  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const error = actionError ?? (fetchError ? fetchError.message : null);

  const goNextOrList = () => {
    if (state?.nextPendingId) {
      router.push(
        `/c/${companyId}/received-invoices/review/${state.nextPendingId}`
      );
    } else {
      router.push(`/c/${companyId}/received-invoices`);
    }
  };

  const handleSaveDraft = async (patch: ReceivedInvoiceReviewInput) => {
    setSaving(true);
    setActionError(null);
    const res = await updateReceivedInvoiceDraft(id, patch);
    setSaving(false);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    setDuplicates(res.data?.duplicates ?? []);
    toast.success('Draft saved.');
  };

  const handleConfirm = async (patch: ReceivedInvoiceReviewInput) => {
    setSaving(true);
    setActionError(null);
    const res = await confirmReceivedInvoice(id, patch);
    setSaving(false);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    goNextOrList();
  };

  const handleDiscard = async () => {
    setConfirmDiscardOpen(true);
  };

  const handleDiscardConfirmed = async () => {
    setSaving(true);
    setActionError(null);
    const res = await discardReceivedInvoice(id);
    setSaving(false);
    if (res.error) {
      setActionError(res.error);
      throw new Error(res.error);
    }
    goNextOrList();
  };

  if (loading) {
    return (
      <section className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  if (fetchError || !state) {
    return (
      <PageShell>
        <ErrorAlert
          message={fetchError ? fetchError.message : 'Could not load invoice'}
          className="mb-4"
        />
        <Button variant="outline" asChild>
          <Link href={`/c/${companyId}/received-invoices`}>← Back to list</Link>
        </Button>
      </PageShell>
    );
  }

  const initial = rowToReviewInput(state.row, state.lines);
  const rawExtractionParsed = ExtractedInvoiceSchema.safeParse(
    state.row.rawExtraction
  );
  const rawExtraction: ExtractedInvoice | null = rawExtractionParsed.success
    ? rawExtractionParsed.data
    : null;

  return (
    <section className="flex-1 p-4 lg:p-6">
      <ReviewHeader
        companyId={companyId}
        status={state.row.status}
        extractionConfidence={state.row.extractionConfidence}
        pendingPosition={state.pendingPosition}
        nextPendingId={state.nextPendingId}
        onSkip={() =>
          state.nextPendingId &&
          router.push(
            `/c/${companyId}/received-invoices/review/${state.nextPendingId}`
          )
        }
      />

      <ErrorAlert message={error} className="mb-4" />
      <DuplicatesWarning duplicates={duplicates} companyId={companyId} />

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

      <ConfirmDialog
        open={confirmDiscardOpen}
        onOpenChange={setConfirmDiscardOpen}
        title="Discard draft?"
        description={
          state.row.invoiceNumber
            ? `Draft № ${state.row.invoiceNumber} will not count in any totals. You can still find it under the Discarded filter.`
            : 'This draft will not count in any totals. You can still find it under the Discarded filter.'
        }
        confirmText="Discard"
        variant="destructive"
        onConfirm={handleDiscardConfirmed}
      />
    </section>
  );
}

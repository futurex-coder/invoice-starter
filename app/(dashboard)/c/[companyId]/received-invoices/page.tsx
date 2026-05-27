'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FileText, Inbox, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  listReceivedInvoices,
  setReceivedInvoiceAccountingStatus,
  setReceivedInvoicePaymentStatus,
  setReceivedInvoiceArchived,
  discardReceivedInvoice,
  hardDeleteDiscardedReceivedInvoice,
  type ListReceivedInvoicesFilters,
} from '@/src/features/received-invoices/actions';
import type {
  AccountingStatus,
  PaymentStatus,
} from '@/src/features/received-invoices/types';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { requireStringParam } from '@/lib/route-params';
import { InvoicesTabsNav } from '@/components/invoices/InvoicesTabsNav';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Pagination } from '@/components/list-page/Pagination';
import { ReceivedInvoiceFilters } from './_components/ReceivedInvoiceFilters';
import { PendingReviewBanner } from '@/components/received-invoices/PendingReviewBanner';
import { ReceivedInvoicesTable } from './_components/ReceivedInvoicesTable';
import { supplierName } from './_components/utils';
import type { ReceivedInvoiceListItem } from '@/src/features/received-invoices/actions';
import { PageShell } from '@/components/page-shell';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function ReceivedInvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');

  // Default: hide drafts. Drafts are surfaced via the pending banner above.
  const [filters, setFilters] = useState<ListReceivedInvoicesFilters>({
    page: 1,
    pageSize: 20,
    status: 'confirmed',
  });
  const [searchInput, setSearchInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  type ConfirmTarget = { item: ReceivedInvoiceListItem; mode: 'discard' | 'hardDelete' };
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  const {
    data,
    isLoading: loading,
    error: fetchError,
    mutate: refetch,
  } = useActionSWR(['receivedInvoices', filters], () => listReceivedInvoices(filters));

  const error = actionError ?? (fetchError ? fetchError.message : null);

  const updateFilters = (patch: Partial<ListReceivedInvoicesFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  };

  const applySearch = () => {
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  };

  const goView = (id: number) =>
    router.push(`/c/${companyId}/received-invoices/${id}`);
  const goReview = (id: number) =>
    router.push(`/c/${companyId}/received-invoices/review/${id}`);
  const goUpload = () =>
    router.push(`/c/${companyId}/received-invoices/upload`);

  const reviewNextPending = () => {
    const first = data?.items.find((i) => i.status === 'draft');
    if (first) {
      goReview(first.id);
      return;
    }
    // No draft on current view (likely filtered out) — switch the filter to draft.
    setFilters((f) => ({ ...f, status: 'draft', page: 1 }));
  };

  const runMutation = async (
    id: number,
    mutator: () => Promise<{ error?: string; data?: unknown }>
  ) => {
    setPendingId(id);
    setActionError(null);
    const res = await mutator();
    setPendingId(null);
    if (res.error) setActionError(res.error);
    else refetch();
  };

  const handlePayment = (id: number, status: PaymentStatus) =>
    runMutation(id, () => setReceivedInvoicePaymentStatus(id, status));
  const handleAccounting = (id: number, status: AccountingStatus) =>
    runMutation(id, () => setReceivedInvoiceAccountingStatus(id, status));
  const handleArchive = (id: number, archived: boolean) =>
    runMutation(id, () => setReceivedInvoiceArchived(id, archived));

  const handleConfirmAction = async () => {
    if (!confirmTarget) return;
    const { item, mode } = confirmTarget;
    setPendingId(item.id);
    setActionError(null);
    const res =
      mode === 'discard'
        ? await discardReceivedInvoice(item.id)
        : await hardDeleteDiscardedReceivedInvoice(item.id);
    setPendingId(null);
    if (res.error) {
      setActionError(res.error);
      throw new Error(res.error);
    }
    refetch();
  };

  const buildDescription = (target: ConfirmTarget | null): string | undefined => {
    if (!target) return undefined;
    const numberPart = target.item.invoiceNumber
      ? `№ ${target.item.invoiceNumber}`
      : `#${target.item.id}`;
    const supplier = supplierName(target.item);
    if (target.mode === 'discard') {
      return `Draft ${numberPart} from ${supplier} will not count in any totals. You can still find it under the Discarded filter.`;
    }
    return `${numberPart} from ${supplier} and the original file will be permanently removed. This cannot be undone.`;
  };

  return (
    <PageShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-medium lg:text-2xl">
            <Inbox className="h-5 w-5" />
            Received invoices
          </h1>
          <p className="text-sm text-gray-500">
            Invoices your partners sent — what you have paid and what you owe.
          </p>
        </div>
        <Button onClick={goUpload} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          Upload invoices
        </Button>
      </div>

      <InvoicesTabsNav
        companyId={companyId}
        active="received"
        pendingReceivedCount={data?.pendingCount}
      />

      {data && (
        <PendingReviewBanner
          count={data.pendingCount}
          description=" — drafts aren't shown in the list below."
          className="mb-4 items-center"
          action={
            <Button size="sm" variant="outline" onClick={reviewNextPending}>
              Review next
            </Button>
          }
        />
      )}

      <ReceivedInvoiceFilters
        filters={filters}
        onFiltersChange={updateFilters}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={applySearch}
      />

      <ErrorAlert message={error} className="mb-4" />

      <Card>
        <CardHeader>
          <CardTitle>Received invoice list</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !data?.items.length ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center text-sm text-gray-500">
              <FileText className="h-8 w-8 text-gray-300" />
              <p>No received invoices match these filters.</p>
              <Button onClick={goUpload} variant="outline">
                Upload an invoice
              </Button>
            </div>
          ) : (
            <ReceivedInvoicesTable
              items={data.items}
              companyId={companyId}
              pendingId={pendingId}
              onView={goView}
              onReview={goReview}
              onMarkPayment={handlePayment}
              onMarkAccounting={handleAccounting}
              onArchive={handleArchive}
              onDiscard={(item) => setConfirmTarget({ item, mode: 'discard' })}
              onHardDelete={(item) => setConfirmTarget({ item, mode: 'hardDelete' })}
            />
          )}
          {data && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={(p) => updateFilters({ page: p })}
            />
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title={
          confirmTarget?.mode === 'hardDelete'
            ? 'Permanently delete invoice?'
            : 'Discard draft?'
        }
        description={buildDescription(confirmTarget)}
        confirmText={
          confirmTarget?.mode === 'hardDelete' ? 'Permanently delete' : 'Discard'
        }
        variant="destructive"
        onConfirm={handleConfirmAction}
      />
    </PageShell>
  );
}

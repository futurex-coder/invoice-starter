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
import { PendingReviewBanner } from './_components/PendingReviewBanner';
import { ReceivedInvoicesTable } from './_components/ReceivedInvoicesTable';

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

  const handleDiscard = (id: number) => {
    if (!confirm('Discard this draft? It will not count in any totals.')) return;
    runMutation(id, () => discardReceivedInvoice(id));
  };

  const handleHardDelete = (id: number) => {
    if (
      !confirm(
        'Permanently delete this discarded invoice? The original file will also be removed. This cannot be undone.'
      )
    ) {
      return;
    }
    runMutation(id, () => hardDeleteDiscardedReceivedInvoice(id));
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
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
          onReviewNext={reviewNextPending}
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
              onDiscard={handleDiscard}
              onHardDelete={handleHardDelete}
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
    </section>
  );
}

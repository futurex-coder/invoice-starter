'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  restoreDiscardedReceivedInvoice,
  hardDeleteDiscardedReceivedInvoice,
  type ListReceivedInvoicesFilters,
} from '@/src/features/received-invoices/actions';
import type {
  AccountingStatus,
  PaymentStatus,
  ReceivedInvoiceLifecycleStatus,
} from '@/src/features/received-invoices/types';
import { useListPageState } from '@/lib/swr/use-list-page-state';
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

// String-typed filters owned by useListPageState (URL-safe).
type ReceivedInvoicesFilterState = {
  search: string;
  status: string;
  paymentStatus: string;
  dateFrom: string;
  dateTo: string;
  archived: string;
};

const RECEIVED_INVOICES_DEFAULTS: ReceivedInvoicesFilterState = {
  search: '',
  // Default: the working set — analyzing / failed / draft / confirmed (only
  // discarded is hidden). Keeps freshly-uploaded rows visible so the async
  // scanner can drive their analysis.
  status: 'all',
  paymentStatus: 'all',
  dateFrom: '',
  dateTo: '',
  archived: 'false',
};

function isLifecycleStatus(value: string): value is ReceivedInvoiceLifecycleStatus {
  return (
    value === 'analyzing' ||
    value === 'failed' ||
    value === 'draft' ||
    value === 'confirmed' ||
    value === 'discarded'
  );
}

// ASYNC-SCAN: max analyze requests in flight at once (respects the AI API).
const MAX_CONCURRENT_ANALYSIS = 5;
const ANALYZE_POLL_MS = 3500;

async function analyzeReceivedInvoice(id: number): Promise<void> {
  await fetch(`/api/received-invoices/${id}/analyze`, { method: 'POST' });
}
function isPaymentStatus(value: string): value is PaymentStatus {
  return value === 'unpaid' || value === 'partial' || value === 'paid';
}

/**
 * Build the action-input shape (`ListReceivedInvoicesFilters`) from the
 * hook's string-typed filter state.
 */
function buildActionFilters(
  f: ReceivedInvoicesFilterState,
  page: number,
  pageSize: number
): ListReceivedInvoicesFilters {
  return {
    page,
    pageSize,
    status: isLifecycleStatus(f.status) ? f.status : undefined,
    paymentStatus: isPaymentStatus(f.paymentStatus) ? f.paymentStatus : undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    includeArchived: f.archived === 'true',
    search: f.search || undefined,
  };
}

/**
 * Build the props shape the existing `ReceivedInvoiceFilters` component
 * expects from the string-typed filter state. (The component reads
 * `filters.status ?? 'all'`, etc. — so `undefined` means "all".)
 */
function buildFilterProps(
  f: ReceivedInvoicesFilterState
): ListReceivedInvoicesFilters {
  return {
    status:
      f.status === 'all'
        ? undefined
        : isLifecycleStatus(f.status)
          ? f.status
          : undefined,
    paymentStatus:
      f.paymentStatus === 'all'
        ? undefined
        : isPaymentStatus(f.paymentStatus)
          ? f.paymentStatus
          : undefined,
    dateFrom: f.dateFrom || undefined,
    dateTo: f.dateTo || undefined,
    includeArchived: f.archived === 'true',
  };
}

export default function ReceivedInvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');

  const list = useListPageState<ReceivedInvoicesFilterState, {
    items: ReceivedInvoiceListItem[];
    total: number;
    page: number;
    pageSize: number;
    pendingCount: number;
  }>({
    swrKey: 'received-invoices',
    defaults: RECEIVED_INVOICES_DEFAULTS,
    action: ({ page, pageSize, ...f }) =>
      listReceivedInvoices(buildActionFilters(f, page, pageSize)),
  });

  const data = list.result;

  const [pendingId, setPendingId] = useState<number | null>(null);

  // ------------------------------------------------------------------
  // ASYNC-SCAN: drive parallel background analysis for 'analyzing' rows.
  // The list owns orchestration so a fresh page load (or a tab that was
  // closed mid-batch) automatically resumes anything still analyzing.
  // ------------------------------------------------------------------
  const analyzingIds = useMemo(
    () =>
      (data?.items ?? [])
        .filter((i) => i.status === 'analyzing')
        .map((i) => i.id),
    [data]
  );

  const startedRef = useRef<Set<number>>(new Set());
  const inFlightRef = useRef(0);
  const refetchRef = useRef(list.refetch);
  useEffect(() => {
    refetchRef.current = list.refetch;
  }, [list.refetch]);

  useEffect(() => {
    if (analyzingIds.length === 0) return;
    let cancelled = false;

    const startNext = () => {
      for (const id of analyzingIds) {
        if (cancelled) return;
        if (inFlightRef.current >= MAX_CONCURRENT_ANALYSIS) return;
        if (startedRef.current.has(id)) continue;
        startedRef.current.add(id);
        inFlightRef.current += 1;
        void analyzeReceivedInvoice(id)
          .catch(() => {
            // Failure is persisted server-side as status 'failed'; the
            // refetch below surfaces it with a Retry affordance.
          })
          .finally(() => {
            inFlightRef.current -= 1;
            if (!cancelled) {
              void refetchRef.current();
              startNext();
            }
          });
      }
    };
    startNext();

    return () => {
      cancelled = true;
    };
  }, [analyzingIds]);

  // Safety-net poll: keep the list fresh while anything is analyzing (also
  // catches rows another tab/device is processing).
  useEffect(() => {
    if (analyzingIds.length === 0) return;
    const t = setInterval(() => {
      void refetchRef.current();
    }, ANALYZE_POLL_MS);
    return () => clearInterval(t);
  }, [analyzingIds.length]);

  const handleRetry = useCallback(async (id: number) => {
    startedRef.current.delete(id);
    setPendingId(id);
    try {
      await analyzeReceivedInvoice(id);
    } finally {
      setPendingId(null);
      await refetchRef.current();
    }
  }, []);

  type ConfirmTarget = { item: ReceivedInvoiceListItem; mode: 'discard' | 'hardDelete' };
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);

  // Adapter: the existing ReceivedInvoiceFilters component sends a
  // `Partial<ListReceivedInvoicesFilters>` patch. Thread each known key into
  // `setFilter` on the hook (which itself resets page to 1).
  const handleFiltersChange = (patch: Partial<ListReceivedInvoicesFilters>) => {
    if ('status' in patch) {
      list.setFilter('status', patch.status ?? 'all');
    }
    if ('paymentStatus' in patch) {
      list.setFilter('paymentStatus', patch.paymentStatus ?? 'all');
    }
    if ('dateFrom' in patch) {
      list.setFilter('dateFrom', patch.dateFrom ?? '');
    }
    if ('dateTo' in patch) {
      list.setFilter('dateTo', patch.dateTo ?? '');
    }
    if ('includeArchived' in patch) {
      list.setFilter('archived', patch.includeArchived ? 'true' : 'false');
    }
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
    list.setFilter('status', 'draft');
  };

  const runItemMutation = async (
    id: number,
    mutator: () => ReturnType<typeof setReceivedInvoicePaymentStatus>
  ) => {
    setPendingId(id);
    try {
      await list.runMutation(mutator);
    } catch {
      // runMutation set actionError already.
    } finally {
      setPendingId(null);
    }
  };

  const handlePayment = (id: number, status: PaymentStatus) =>
    runItemMutation(id, () => setReceivedInvoicePaymentStatus(id, status));
  const handleAccounting = (id: number, status: AccountingStatus) =>
    runItemMutation(id, () => setReceivedInvoiceAccountingStatus(id, status));
  const handleArchive = (id: number, archived: boolean) =>
    runItemMutation(id, () => setReceivedInvoiceArchived(id, archived));

  const handleConfirmAction = async () => {
    if (!confirmTarget) return;
    const { item, mode } = confirmTarget;
    setPendingId(item.id);
    try {
      await list.runMutation(() =>
        mode === 'discard'
          ? discardReceivedInvoice(item.id)
          : hardDeleteDiscardedReceivedInvoice(item.id)
      );
    } finally {
      setPendingId(null);
    }
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
          description=" awaiting review — analyzed and saved as drafts below."
          className="mb-4 items-center"
          action={
            <Button size="sm" variant="outline" onClick={reviewNextPending}>
              Review next
            </Button>
          }
        />
      )}

      <ReceivedInvoiceFilters
        filters={buildFilterProps(list.filters)}
        onFiltersChange={handleFiltersChange}
        searchInput={list.searchInput}
        onSearchInputChange={list.setSearchInput}
        onSearchSubmit={list.commitSearch}
      />

      <ErrorAlert message={list.error} className="mb-4" />

      <Card>
        <CardHeader>
          <CardTitle>Received invoice list</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {list.loading ? (
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
              onRestore={(id) =>
                void list.runMutation(() => restoreDiscardedReceivedInvoice(id))
              }
              onHardDelete={(item) => setConfirmTarget({ item, mode: 'hardDelete' })}
              onRetry={handleRetry}
            />
          )}
          {data && (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={list.setPage}
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

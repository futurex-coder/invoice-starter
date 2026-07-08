'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  listInvoices,
  cancelInvoice,
  uncancelInvoice,
  createCreditNoteFromInvoice,
  createDebitNoteFromInvoice,
  updateInvoicePaymentInfo,
  updateInvoiceAccountingStatus,
  type ListInvoicesFilters,
} from '@/src/features/bulgarian-invoicing/actions';
import { formatInvoiceNumber } from '@/src/features/bulgarian-invoicing/formatter';
import type { Invoice, InvoiceStatus } from '@/lib/db/schema';
import { useListPageState } from '@/lib/swr/use-list-page-state';
import { requireStringParam } from '@/lib/route-params';
import { Plus } from 'lucide-react';
import { ListPageHeader } from '@/components/list-page/ListPageHeader';
import { ListCard } from '@/components/list-page/ListCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { InvoicesTabsNav } from '@/components/invoices/InvoicesTabsNav';
import { InvoiceFilters } from './_components/InvoiceFilters';
import { InvoicesTable } from './_components/InvoicesTable';
import { PageShell } from '@/components/page-shell';

// String-typed filters owned by useListPageState (URL-safe).
type InvoicesFilterState = {
  search: string;
  status: string;
  paymentStatus: string;
  accountingStatus: string;
  month: string;
};

const INVOICES_DEFAULTS: InvoicesFilterState = {
  search: '',
  status: 'all',
  paymentStatus: 'all',
  accountingStatus: 'all',
  month: '',
};

function isInvoiceStatusEnum(value: string): value is InvoiceStatus {
  return value === 'draft' || value === 'finalized' || value === 'cancelled';
}

function buildActionFilters(
  f: InvoicesFilterState,
  page: number,
  pageSize: number
): ListInvoicesFilters {
  return {
    page,
    pageSize,
    status: f.status === 'all' || !isInvoiceStatusEnum(f.status) ? undefined : f.status,
    paymentStatus: f.paymentStatus === 'all' ? undefined : f.paymentStatus,
    accountingStatus:
      f.accountingStatus === 'all' ? undefined : f.accountingStatus,
    month: f.month || undefined,
    search: f.search || undefined,
  };
}

function buildFilterProps(f: InvoicesFilterState): ListInvoicesFilters {
  return {
    status:
      f.status === 'all'
        ? undefined
        : isInvoiceStatusEnum(f.status)
          ? f.status
          : undefined,
    paymentStatus: f.paymentStatus === 'all' ? undefined : f.paymentStatus,
    accountingStatus:
      f.accountingStatus === 'all' ? undefined : f.accountingStatus,
    month: f.month || undefined,
  };
}

export default function InvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');

  const list = useListPageState({
    swrKey: 'invoices',
    defaults: INVOICES_DEFAULTS,
    action: ({ page, pageSize, ...f }) =>
      listInvoices(buildActionFilters(f, page, pageSize)),
  });

  const result = list.result;

  const [confirmCancel, setConfirmCancel] = useState<{ id: number; label: string } | null>(null);

  const handleFiltersChange = (patch: Partial<ListInvoicesFilters>) => {
    if ('status' in patch) list.setFilter('status', patch.status ?? 'all');
    if ('paymentStatus' in patch) {
      list.setFilter('paymentStatus', patch.paymentStatus ?? 'all');
    }
    if ('accountingStatus' in patch) {
      list.setFilter('accountingStatus', patch.accountingStatus ?? 'all');
    }
    if ('month' in patch) list.setFilter('month', patch.month ?? '');
  };

  const handleCancelClick = (invoice: Invoice) => {
    const label =
      invoice.number != null
        ? `№ ${formatInvoiceNumber(invoice.number)}`
        : `#${invoice.id}`;
    setConfirmCancel({ id: invoice.id, label });
  };

  const handleCancelConfirmed = async () => {
    if (!confirmCancel) return;
    await list.runMutation(() => cancelInvoice(confirmCancel.id));
  };

  // EDIT-RULE: cancel is reversible.
  const handleUncancel = (id: number) => {
    void list.runMutation(() => uncancelInvoice(id));
  };

  const [pendingId, setPendingId] = useState<number | null>(null);

  // OI-9: inline paid / accounted toggles with the N11 optimistic pattern.
  const handleMarkPayment = async (id: number, status: 'paid' | 'unpaid') => {
    setPendingId(id);
    try {
      await list.runMutation(() =>
        updateInvoicePaymentInfo(id, { paymentStatus: status })
      );
    } finally {
      setPendingId(null);
    }
  };

  const handleMarkAccounting = async (
    id: number,
    status: 'accounted' | 'pending'
  ) => {
    setPendingId(id);
    try {
      await list.runMutation(() => updateInvoiceAccountingStatus(id, status));
    } finally {
      setPendingId(null);
    }
  };

  const handleCreditNote = async (id: number) => {
    const res = await createCreditNoteFromInvoice(id);
    if (res.error) list.setActionError(res.error);
    else if (res.data) router.push(`/c/${companyId}/invoices/${res.data.id}`);
  };

  const handleDebitNote = async (id: number) => {
    const res = await createDebitNoteFromInvoice(id);
    if (res.error) list.setActionError(res.error);
    else if (res.data) router.push(`/c/${companyId}/invoices/${res.data.id}`);
  };

  return (
    <PageShell>
      <ListPageHeader
        title="Invoices"
        action={
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href={`/c/${companyId}/invoices/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New invoice
            </Link>
          </Button>
        }
      />

      <InvoicesTabsNav companyId={companyId} active="outgoing" />

      <InvoiceFilters
        filters={buildFilterProps(list.filters)}
        onFiltersChange={handleFiltersChange}
        searchInput={list.searchInput}
        onSearchInputChange={list.setSearchInput}
        onSearchSubmit={list.commitSearch}
      />

      <ErrorAlert message={list.error} className="mb-4" />

      <ListCard
        title="Invoice list"
        loading={list.loading}
        isEmpty={!result?.invoices.length}
        emptyMessage='No invoices found. Create one with "New invoice".'
        page={list.page}
        pageSize={list.pageSize}
        total={result?.total}
        onPageChange={list.setPage}
      >
        <InvoicesTable
          invoices={result?.invoices ?? []}
          companyId={companyId}
          pendingId={pendingId}
          onView={(id) => router.push(`/c/${companyId}/invoices/${id}`)}
          onEdit={(id) => router.push(`/c/${companyId}/invoices/new?edit=${id}`)}
          onPrint={(id) => router.push(`/c/${companyId}/invoices/${id}?print=1`)}
          onCancel={handleCancelClick}
          onUncancel={handleUncancel}
          onCopy={(id) => router.push(`/c/${companyId}/invoices/new?copy=${id}`)}
          onCreditNote={handleCreditNote}
          onDebitNote={handleDebitNote}
          onMarkPayment={handleMarkPayment}
          onMarkAccounting={handleMarkAccounting}
        />
      </ListCard>

      <ConfirmDialog
        open={confirmCancel !== null}
        onOpenChange={(open) => !open && setConfirmCancel(null)}
        title="Cancel invoice?"
        description={
          confirmCancel
            ? `Invoice ${confirmCancel.label} will be marked as cancelled. This cannot be undone — issue a credit note instead if you need to reverse it.`
            : undefined
        }
        confirmText="Cancel invoice"
        cancelText="Keep invoice"
        variant="destructive"
        onConfirm={handleCancelConfirmed}
      />
    </PageShell>
  );
}

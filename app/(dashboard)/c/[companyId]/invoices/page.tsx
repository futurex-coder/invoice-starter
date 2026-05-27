'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  listInvoices,
  cancelInvoice,
  createCreditNoteFromInvoice,
  createDebitNoteFromInvoice,
  type ListInvoicesFilters,
} from '@/src/features/bulgarian-invoicing/actions';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { requireStringParam } from '@/lib/route-params';
import { Plus } from 'lucide-react';
import { ListPageHeader } from '@/components/list-page/ListPageHeader';
import { ListCard } from '@/components/list-page/ListCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { InvoicesTabsNav } from '@/components/invoices/InvoicesTabsNav';
import { InvoiceFilters } from './_components/InvoiceFilters';
import { InvoicesTable } from './_components/InvoicesTable';

export default function InvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');
  const [filters, setFilters] = useState<ListInvoicesFilters>({
    page: 1,
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = useState('');

  const {
    data: result,
    isLoading: loading,
    error: fetchError,
    mutate: refetch,
  } = useActionSWR(['invoices', filters], () => listInvoices(filters));

  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (fetchError ? fetchError.message : null);

  const handleFiltersChange = (patch: Partial<ListInvoicesFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  };

  const applySearch = () => {
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this invoice? This cannot be undone.')) return;
    const res = await cancelInvoice(id);
    if (res.error) setActionError(res.error);
    else refetch();
  };

  const handleCreditNote = async (id: number) => {
    const res = await createCreditNoteFromInvoice(id);
    if (res.error) setActionError(res.error);
    else if (res.data) router.push(`/c/${companyId}/invoices/${res.data.id}`);
  };

  const handleDebitNote = async (id: number) => {
    const res = await createDebitNoteFromInvoice(id);
    if (res.error) setActionError(res.error);
    else if (res.data) router.push(`/c/${companyId}/invoices/${res.data.id}`);
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
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
        filters={filters}
        onFiltersChange={handleFiltersChange}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearchSubmit={applySearch}
      />

      <ErrorAlert message={error} className="mb-4" />

      <ListCard
        title="Invoice list"
        loading={loading}
        isEmpty={!result?.invoices.length}
        emptyMessage='No invoices found. Create one with "New invoice".'
        page={result?.page}
        pageSize={result?.pageSize}
        total={result?.total}
        onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
      >
        <InvoicesTable
          invoices={result?.invoices ?? []}
          companyId={companyId}
          onView={(id) => router.push(`/c/${companyId}/invoices/${id}`)}
          onEdit={(id) => router.push(`/c/${companyId}/invoices/new?edit=${id}`)}
          onPrint={(id) => router.push(`/c/${companyId}/invoices/${id}?print=1`)}
          onCancel={handleCancel}
          onCopy={() => {}}
          onCreditNote={handleCreditNote}
          onDebitNote={handleDebitNote}
        />
      </ListCard>
    </section>
  );
}

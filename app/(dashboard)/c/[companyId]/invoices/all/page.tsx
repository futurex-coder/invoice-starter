'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  listAllDocuments,
  type AllDocumentRow,
} from '@/src/features/invoicing/actions';
import { useListPageState } from '@/lib/swr/use-list-page-state';
import { requireStringParam } from '@/lib/route-params';
import { ListPageHeader } from '@/components/list-page/ListPageHeader';
import { ListCard } from '@/components/list-page/ListCard';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { InvoicesTabsNav } from '@/components/invoices/InvoicesTabsNav';
import { DataTableHead, DATA_ROW_CLASS } from '@/components/list-page/DataTableHead';
import { formatDate, formatMoney } from '@/lib/format';
import { PageShell } from '@/components/page-shell';
import { cn } from '@/lib/utils';

type AllFilterState = { search: string; month: string };
const ALL_DEFAULTS: AllFilterState = { search: '', month: '' };

function DirectionBadge({ direction }: { direction: AllDocumentRow['direction'] }) {
  const outgoing = direction === 'outgoing';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        outgoing ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
      )}
    >
      {outgoing ? (
        <ArrowUpRight className="h-3 w-3" />
      ) : (
        <ArrowDownLeft className="h-3 w-3" />
      )}
      {outgoing ? 'Издадена' : 'Получена'}
    </span>
  );
}

export default function AllDocumentsPage() {
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');

  const list = useListPageState({
    swrKey: 'allDocuments',
    defaults: ALL_DEFAULTS,
    action: ({ page, pageSize, search, month }) =>
      listAllDocuments({
        page,
        pageSize,
        search: search || undefined,
        month: month || undefined,
      }),
  });

  const result = list.result;

  const rowHref = (r: AllDocumentRow) =>
    r.direction === 'outgoing'
      ? `/c/${companyId}/invoices/${r.id}`
      : `/c/${companyId}/received-invoices/${r.id}`;

  return (
    <PageShell>
      <ListPageHeader title="Invoices" />
      <InvoicesTabsNav companyId={companyId} active="all" />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-44">
            <Label htmlFor="all-month">Month</Label>
            <Input
              id="all-month"
              type="month"
              className="mt-1"
              value={list.filters.month}
              onChange={(e) => list.setFilter('month', e.target.value)}
            />
          </div>
          <div className="w-full sm:w-64">
            <Label htmlFor="all-search">Number / Counterparty</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="all-search"
                placeholder="Search..."
                value={list.searchInput}
                onChange={(e) => list.setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && list.commitSearch()}
              />
              <Button variant="outline" onClick={list.commitSearch}>
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ErrorAlert message={list.error} className="mb-4" />

      <ListCard
        title="All documents"
        loading={list.loading}
        isEmpty={!result?.items.length}
        emptyMessage="No documents match."
        page={list.page}
        pageSize={list.pageSize}
        total={result?.total}
        onPageChange={list.setPage}
      >
        <table className="w-full">
          <DataTableHead
            columns={[
              { label: 'Direction' },
              { label: 'Number' },
              { label: 'Counterparty' },
              { label: 'Date' },
              { label: 'Total' },
              { label: 'Paid' },
              { label: 'Accounted' },
              { label: 'Status' },
            ]}
          />
          <tbody>
            {(result?.items ?? []).map((r) => (
              <tr key={`${r.direction}-${r.id}`} className={DATA_ROW_CLASS}>
                <td className="px-4 py-3">
                  <DirectionBadge direction={r.direction} />
                </td>
                <td className="px-4 py-3 text-sm">
                  <Link
                    href={rowHref(r)}
                    className="font-medium text-blue-700 hover:underline"
                  >
                    {r.number ?? `#${r.id}`}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm">{r.counterparty ?? '—'}</td>
                <td className="px-4 py-3 text-sm">
                  {r.issueDate ? formatDate(r.issueDate) : '—'}
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  {formatMoney(r.grossAmount)} {r.currency}
                </td>
                <td className="px-4 py-3 text-sm capitalize">{r.paymentStatus}</td>
                <td className="px-4 py-3 text-sm capitalize">
                  {r.accountingStatus}
                </td>
                <td className="px-4 py-3 text-sm capitalize">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ListCard>
    </PageShell>
  );
}

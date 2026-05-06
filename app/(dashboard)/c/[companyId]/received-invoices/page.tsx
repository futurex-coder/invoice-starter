'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle,
  CircleDot,
  CircleSlash2,
  ExternalLink,
  Eye,
  FileText,
  Inbox,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  listReceivedInvoices,
  setReceivedInvoiceAccountingStatus,
  setReceivedInvoicePaymentStatus,
  setReceivedInvoiceArchived,
  discardReceivedInvoice,
  hardDeleteDiscardedReceivedInvoice,
  type ListReceivedInvoicesFilters,
  type ReceivedInvoiceListItem,
} from '@/src/features/received-invoices/actions';
import type {
  AccountingStatus,
  PaymentStatus,
  SupplierSnapshot,
} from '@/src/features/received-invoices/types';

interface ListData {
  items: ReceivedInvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  discarded: 'Discarded',
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};
function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB');
}

function supplierName(item: ReceivedInvoiceListItem): string {
  if (item.partnerName) return item.partnerName;
  const snap = (item.supplierSnapshot ?? {}) as SupplierSnapshot;
  return snap.legalName ?? '—';
}

function isOverdue(
  dueDate: string | null,
  paymentStatus: string,
  status: string
): boolean {
  if (status !== 'confirmed') return false;
  if (paymentStatus === 'paid') return false;
  if (!dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

function ReceivedInvoiceTableRow({
  item,
  companyId,
  pending,
  onView,
  onReview,
  onMarkPayment,
  onMarkAccounting,
  onArchive,
  onDiscard,
  onHardDelete,
}: {
  item: ReceivedInvoiceListItem;
  companyId: string;
  pending: boolean;
  onView: (id: number) => void;
  onReview: (id: number) => void;
  onMarkPayment: (id: number, status: PaymentStatus) => void;
  onMarkAccounting: (id: number, status: AccountingStatus) => void;
  onArchive: (id: number, archived: boolean) => void;
  onDiscard: (id: number) => void;
  onHardDelete: (id: number) => void;
}) {
  const archived = item.archivedAt != null;
  const isDraft = item.status === 'draft';
  const isConfirmed = item.status === 'confirmed';
  const isDiscarded = item.status === 'discarded';
  const overdue = isOverdue(item.dueDate, item.paymentStatus, item.status);

  return (
    <tr
      className={`border-b border-gray-200 ${
        overdue
          ? 'bg-red-50 hover:bg-red-100/70'
          : archived
          ? 'opacity-60 hover:bg-gray-50/50'
          : 'hover:bg-gray-50/50'
      }`}
    >
      <td className="w-8 px-2 py-3">
        <a
          href={`/api/received-invoices/${item.id}/file?redirect=1`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title={`Open original (${item.fileMimeType === 'application/pdf' ? 'PDF' : 'image'})`}
          aria-label="Open original file"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </td>
      <td className="px-4 py-3 text-sm">
        {item.invoiceNumber ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3 text-sm">{supplierName(item)}</td>
      <td className="px-4 py-3 text-sm">{formatDate(item.issueDate)}</td>
      <td className="px-4 py-3 text-sm">
        {isConfirmed ? (
          <>
            {PAYMENT_STATUS_LABELS[item.paymentStatus] ?? item.paymentStatus}
            {overdue && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                Overdue
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm font-medium">
        {Number(item.grossAmount).toFixed(2)} {item.currency}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            isDiscarded
              ? 'bg-gray-200 text-gray-700'
              : isDraft
              ? 'bg-amber-100 text-amber-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {STATUS_LABELS[item.status] ?? item.status}
        </span>
        {isConfirmed && item.accountingStatus === 'accounted' && (
          <span className="ml-1.5 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            Accounted
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={pending}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MoreHorizontal className="h-4 w-4" />
              )}
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {isDraft && (
              <>
                <DropdownMenuItem onClick={() => onReview(item.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Review draft
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={`/api/received-invoices/${item.id}/file?redirect=1`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open original file
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDiscard(item.id)}
                  className="text-red-700 focus:text-red-700"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Discard draft
                </DropdownMenuItem>
              </>
            )}

            {isConfirmed && (
              <>
                <DropdownMenuItem onClick={() => onView(item.id)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={`/api/received-invoices/${item.id}/file?redirect=1`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open original file
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onReview(item.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {item.paymentStatus !== 'paid' && (
                  <DropdownMenuItem
                    onClick={() => onMarkPayment(item.id, 'paid')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                    Mark paid
                  </DropdownMenuItem>
                )}
                {item.paymentStatus !== 'partial' && (
                  <DropdownMenuItem
                    onClick={() => onMarkPayment(item.id, 'partial')}
                  >
                    <CircleDot className="mr-2 h-4 w-4 text-yellow-600" />
                    Mark partial
                  </DropdownMenuItem>
                )}
                {item.paymentStatus !== 'unpaid' && (
                  <DropdownMenuItem
                    onClick={() => onMarkPayment(item.id, 'unpaid')}
                  >
                    <CircleSlash2 className="mr-2 h-4 w-4 text-red-600" />
                    Mark unpaid
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {item.accountingStatus === 'pending' ? (
                  <DropdownMenuItem
                    onClick={() => onMarkAccounting(item.id, 'accounted')}
                  >
                    <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />
                    Mark as accounted
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={() => onMarkAccounting(item.id, 'pending')}
                  >
                    <CircleDot className="mr-2 h-4 w-4 text-amber-600" />
                    Mark as pending accounting
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => onArchive(item.id, !archived)}
                >
                  {archived ? (
                    <>
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Unarchive
                    </>
                  ) : (
                    <>
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </>
                  )}
                </DropdownMenuItem>
              </>
            )}

            {isDiscarded && (
              <>
                <DropdownMenuItem asChild>
                  <Link href={`/c/${companyId}/received-invoices/${item.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={`/api/received-invoices/${item.id}/file?redirect=1`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open original file
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onHardDelete(item.id)}
                  className="text-red-700 focus:text-red-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Permanently delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

export default function ReceivedInvoicesPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;

  // Default: hide drafts. Drafts are surfaced via the pending banner above.
  const [filters, setFilters] = useState<ListReceivedInvoicesFilters>({
    page: 1,
    pageSize: 20,
    status: 'confirmed',
  });
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    const res = await listReceivedInvoices(filters);
    setLoading(false);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    if (res.data) setData(res.data);
  }, [filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchList();
  }, [fetchList]);

  const applySearch = () => {
    setFilters((f) => ({
      ...f,
      search: searchInput || undefined,
      page: 1,
    }));
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
    // No draft on current view (likely filtered out) — go to review queue by
    // switching the filter to draft.
    setFilters((f) => ({ ...f, status: 'draft', page: 1 }));
  };

  const handlePayment = async (id: number, status: PaymentStatus) => {
    setPendingId(id);
    const res = await setReceivedInvoicePaymentStatus(id, status);
    setPendingId(null);
    if (res.error) setActionError(res.error);
    else fetchList();
  };

  const handleAccounting = async (id: number, status: AccountingStatus) => {
    setPendingId(id);
    const res = await setReceivedInvoiceAccountingStatus(id, status);
    setPendingId(null);
    if (res.error) setActionError(res.error);
    else fetchList();
  };

  const handleArchive = async (id: number, archived: boolean) => {
    setPendingId(id);
    const res = await setReceivedInvoiceArchived(id, archived);
    setPendingId(null);
    if (res.error) setActionError(res.error);
    else fetchList();
  };

  const handleDiscard = async (id: number) => {
    if (!confirm('Discard this draft? It will not count in any totals.')) {
      return;
    }
    setPendingId(id);
    const res = await discardReceivedInvoice(id);
    setPendingId(null);
    if (res.error) setActionError(res.error);
    else fetchList();
  };

  const handleHardDelete = async (id: number) => {
    if (
      !confirm(
        'Permanently delete this discarded invoice? The original file will also be removed. This cannot be undone.'
      )
    ) {
      return;
    }
    setPendingId(id);
    const res = await hardDeleteDiscardedReceivedInvoice(id);
    setPendingId(null);
    if (res.error) setActionError(res.error);
    else fetchList();
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
        <Button
          onClick={goUpload}
          className="bg-orange-500 hover:bg-orange-600"
        >
          <Plus className="mr-2 h-4 w-4" />
          Upload invoices
        </Button>
      </div>

      {data && data.pendingCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <span>
              <strong>{data.pendingCount}</strong>{' '}
              {data.pendingCount === 1 ? 'invoice' : 'invoices'} pending review
              <span className="ml-1 text-amber-700">
                — drafts aren&apos;t shown in the list below.
              </span>
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={reviewNextPending}>
            Review next
          </Button>
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-44">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={filters.status ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: (e.target.value || undefined) as ListReceivedInvoicesFilters['status'],
                  page: 1,
                }))
              }
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="discarded">Discarded</option>
            </select>
          </div>
          <div className="w-full sm:w-44">
            <Label htmlFor="paymentStatus">Payment</Label>
            <select
              id="paymentStatus"
              className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={filters.paymentStatus ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  paymentStatus: (e.target.value || undefined) as ListReceivedInvoicesFilters['paymentStatus'],
                  page: 1,
                }))
              }
            >
              <option value="">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div className="w-full sm:w-40">
            <Label htmlFor="dateFrom">From date</Label>
            <Input
              id="dateFrom"
              type="date"
              className="mt-1"
              value={filters.dateFrom ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  dateFrom: e.target.value || undefined,
                  page: 1,
                }))
              }
            />
          </div>
          <div className="w-full sm:w-40">
            <Label htmlFor="dateTo">To date</Label>
            <Input
              id="dateTo"
              type="date"
              className="mt-1"
              value={filters.dateTo ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  dateTo: e.target.value || undefined,
                  page: 1,
                }))
              }
            />
          </div>
          <div className="w-full sm:w-56">
            <Label htmlFor="search">Number / Supplier</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="search"
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch();
                }}
              />
              <Button variant="outline" onClick={applySearch}>
                Search
              </Button>
            </div>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={filters.includeArchived ?? false}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  includeArchived: e.target.checked,
                  page: 1,
                }))
              }
            />
            Include archived
          </label>
        </CardContent>
      </Card>

      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

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
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="w-8 px-2 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <ReceivedInvoiceTableRow
                    key={item.id}
                    item={item}
                    companyId={companyId}
                    pending={pendingId === item.id}
                    onView={goView}
                    onReview={goReview}
                    onMarkPayment={handlePayment}
                    onMarkAccounting={handleAccounting}
                    onArchive={handleArchive}
                    onDiscard={handleDiscard}
                    onHardDelete={handleHardDelete}
                  />
                ))}
              </tbody>
            </table>
          )}
          {data && data.total > data.pageSize && (
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-3">
              <p className="text-sm text-gray-600">
                Showing {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} of{' '}
                {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page * data.pageSize >= data.total}
                  onClick={() =>
                    setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}


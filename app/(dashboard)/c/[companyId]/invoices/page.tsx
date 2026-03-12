'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  listInvoices,
  cancelInvoice,
  createCreditNoteFromInvoice,
  createDebitNoteFromInvoice,
  type ListInvoicesFilters,
} from '@/src/features/bulgarian-invoicing/actions';
import { formatDocTypeLabel, formatInvoiceNumber, formatMoney, formatDateBg } from '@/src/features/bulgarian-invoicing/formatter';
import type { Invoice } from '@/lib/db/schema';
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Printer,
  XCircle,
  Copy,
  FileDown,
  FileUp,
  Loader2,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  issued: 'Issued',
  cancelled: 'Cancelled',
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  partial: 'Partial',
};

function InvoiceTableRow({
  invoice,
  onView,
  onEdit,
  onPrint,
  onCancel,
  onCopy,
  onCreditNote,
  onDebitNote,
}: {
  invoice: Invoice;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onCancel: (id: number) => void;
  onCopy: (id: number) => void;
  onCreditNote: (id: number) => void;
  onDebitNote: (id: number) => void;
}) {
  const totals = (invoice.totals ?? { totalGross: 0 }) as { totalGross: number };
  const recipient = (invoice.recipientSnapshot ?? {}) as { legalName?: string };
  const isDraft = invoice.status === 'draft';
  const isIssued = invoice.status === 'issued';
  const isCancelled = invoice.status === 'cancelled';

  return (
    <tr className="border-b border-gray-200 hover:bg-gray-50/50">
      <td className="px-4 py-3 text-sm">
        {invoice.number != null
          ? formatInvoiceNumber(invoice.number)
          : `#${invoice.id}`}
      </td>
      <td className="px-4 py-3 text-sm">
        {formatDocTypeLabel(invoice.docType)}
      </td>
      <td className="px-4 py-3 text-sm">
        {recipient.legalName ?? '—'}
      </td>
      <td className="px-4 py-3 text-sm">
        {formatDateBg(invoice.issueDate)}
      </td>
      <td className="px-4 py-3 text-sm">
        {PAYMENT_STATUS_LABELS[invoice.paymentStatus ?? 'unpaid'] ?? invoice.paymentStatus}
      </td>
      <td className="px-4 py-3 text-sm font-medium">
        {formatMoney(totals.totalGross)} {invoice.currency}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            isCancelled
              ? 'bg-gray-200 text-gray-700'
              : isDraft
              ? 'bg-amber-100 text-amber-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {STATUS_LABELS[invoice.status] ?? invoice.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(invoice.id)}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
            {isDraft && (
              <DropdownMenuItem onClick={() => onEdit(invoice.id)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit draft
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onPrint(invoice.id)}>
              <Printer className="mr-2 h-4 w-4" />
              Print / Preview
            </DropdownMenuItem>
            {!isCancelled && isIssued && (
              <>
                <DropdownMenuItem onClick={() => onCancel(invoice.id)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancel
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopy(invoice.id)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreditNote(invoice.id)}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Create credit note
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDebitNote(invoice.id)}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Create debit note
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

export default function InvoicesPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<ListInvoicesFilters>({
    page: 1,
    pageSize: 20,
  });
  const [searchInput, setSearchInput] = useState('');
  const [result, setResult] = useState<{
    invoices: Invoice[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setActionError(null);
    const res = await listInvoices(filters);
    setLoading(false);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    if (res.data) setResult(res.data);
  }, [filters]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const applySearch = () => {
    setFilters((f) => ({ ...f, search: searchInput || undefined, page: 1 }));
  };

  const handleCancel = async (id: number) => {
    if (!confirm('Cancel this invoice? This cannot be undone.')) return;
    const res = await cancelInvoice(id);
    if (res.error) setActionError(res.error);
    else fetchInvoices();
  };

  const handleCreditNote = async (id: number) => {
    const res = await createCreditNoteFromInvoice(id);
    if (res.error) setActionError(res.error);
    // TODO: update to company-scoped route in Phase 4
    else if (res.data) router.push(`/dashboard/invoices/${res.data.id}`);
  };

  const handleDebitNote = async (id: number) => {
    const res = await createDebitNoteFromInvoice(id);
    if (res.error) setActionError(res.error);
    // TODO: update to company-scoped route in Phase 4
    else if (res.data) router.push(`/dashboard/invoices/${res.data.id}`);
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-lg lg:text-2xl font-medium">Invoices</h1>
        <Button asChild className="bg-orange-500 hover:bg-orange-600">
          {/* TODO: update to company-scoped route in Phase 4 */}
          <Link href="/dashboard/invoices/new">
            <Plus className="mr-2 h-4 w-4" />
            New invoice
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 items-end">
          <div className="w-full sm:w-48">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={filters.status ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  status: (e.target.value || undefined) as ListInvoicesFilters['status'],
                  page: 1,
                }))
              }
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="w-full sm:w-48">
            <Label htmlFor="paymentStatus">Payment</Label>
            <select
              id="paymentStatus"
              className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={filters.paymentStatus ?? ''}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  paymentStatus: e.target.value || undefined,
                  page: 1,
                }))
              }
            >
              <option value="">All</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
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
                setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined, page: 1 }))
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
                setFilters((f) => ({ ...f, dateTo: e.target.value || undefined, page: 1 }))
              }
            />
          </div>
          <div className="w-full sm:w-48">
            <Label htmlFor="search">Number / Client</Label>
            <div className="flex gap-2 mt-1">
              <Input
                id="search"
                placeholder="Search..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              />
              <Button variant="outline" onClick={applySearch}>
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {actionError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoice list</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : !result?.invoices.length ? (
            <p className="px-6 py-8 text-muted-foreground text-sm">
              No invoices found. Create one with &quot;New invoice&quot;.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Number
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.invoices.map((inv) => (
                  <InvoiceTableRow
                    key={inv.id}
                    invoice={inv}
                    onView={(id) => router.push(`/dashboard/invoices/${id}`)}
                    onEdit={(id) => router.push(`/dashboard/invoices/new?edit=${id}`)}
                    onPrint={(id) => router.push(`/dashboard/invoices/${id}?print=1`)}
                    onCancel={handleCancel}
                    onCopy={() => {}}
                    onCreditNote={handleCreditNote}
                    onDebitNote={handleDebitNote}
                  />
                ))}
              </tbody>
            </table>
          )}
          {result && result.total > result.pageSize && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {(result.page - 1) * result.pageSize + 1}–{Math.min(result.page * result.pageSize, result.total)} of {result.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page <= 1}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={result.page * result.pageSize >= result.total}
                  onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
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

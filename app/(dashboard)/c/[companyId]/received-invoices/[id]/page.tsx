'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { requireStringParam } from '@/lib/route-params';
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Loader2,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getReceivedInvoice,
  setReceivedInvoiceAccountingStatus,
  setReceivedInvoicePaymentStatus,
  setReceivedInvoiceArchived,
} from '@/src/features/received-invoices/actions';
import type {
  AccountingStatus,
  PaymentStatus,
} from '@/src/features/received-invoices/types';
import {
  isAccountingStatus,
  isPaymentStatus,
  parseSupplierSnapshot,
} from '@/src/features/received-invoices/parsers';
import { StatusBadge } from '@/components/received-invoices/StatusBadge';
import { PreviewPane } from '@/components/received-invoices/PreviewPane';
import type {
  ReceivedInvoice,
  ReceivedInvoiceLine,
} from '@/lib/db/schema';

interface LoadedState {
  row: ReceivedInvoice;
  lines: ReceivedInvoiceLine[];
  fileSignedUrl: string;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB');
}

export default function ReceivedInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');
  const id = Number(params.id);

  const [state, setState] = useState<LoadedState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getReceivedInvoice(id);
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error ?? 'Could not load invoice');
      return;
    }
    setState({
      row: res.data.row,
      lines: res.data.lines,
      fileSignedUrl: res.data.fileSignedUrl,
    });
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (loading) {
    return (
      <section className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  if (error || !state) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error ?? 'Not found'}
        </div>
        <Button variant="outline" asChild>
          <Link href={`/c/${companyId}/received-invoices`}>← Back to list</Link>
        </Button>
      </section>
    );
  }

  const { row, lines } = state;

  // Drafts redirect to the review page; the detail page is for confirmed/discarded.
  if (row.status === 'draft') {
    router.replace(`/c/${companyId}/received-invoices/review/${id}`);
    return null;
  }

  const supplier = parseSupplierSnapshot(row.supplierSnapshot);
  const archived = row.archivedAt != null;

  const handleAccounting = async (value: AccountingStatus) => {
    await setReceivedInvoiceAccountingStatus(id, value);
    load();
  };
  const handlePayment = async (value: PaymentStatus) => {
    await setReceivedInvoicePaymentStatus(id, value);
    load();
  };
  const handleArchive = async () => {
    await setReceivedInvoiceArchived(id, !archived);
    load();
  };

  return (
    <section className="flex-1 p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/c/${companyId}/received-invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-medium lg:text-xl">
          {supplier.legalName ?? 'Received invoice'}
          {row.invoiceNumber && (
            <span className="ml-2 text-gray-500">№ {row.invoiceNumber}</span>
          )}
        </h1>
        <StatusBadge variant="lifecycle" value={row.status} />
        {archived && (
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-700">
            Archived
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {row.status === 'confirmed' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleArchive}
                title={archived ? 'Unarchive' : 'Archive'}
              >
                {archived ? (
                  <>
                    <ArchiveRestore className="mr-1 h-4 w-4" />
                    Unarchive
                  </>
                ) : (
                  <>
                    <Archive className="mr-1 h-4 w-4" />
                    Archive
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    `/c/${companyId}/received-invoices/review/${id}`
                  )
                }
              >
                <Pencil className="mr-1 h-4 w-4" />
                Edit
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
          <PreviewPane
            receivedInvoiceId={id}
            fileMimeType={row.fileMimeType}
            fileOriginalName={row.fileOriginalName}
            initialSignedUrl={state.fileSignedUrl}
          />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Supplier</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-medium">{supplier.legalName ?? '—'}</p>
              {supplier.eik && <p>EIK: {supplier.eik}</p>}
              {supplier.vatNumber && <p>VAT: {supplier.vatNumber}</p>}
              {(supplier.street || supplier.city || supplier.country) && (
                <p className="text-gray-600">
                  {[supplier.street, supplier.city, supplier.country]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Document</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500">Invoice number</span>
                <p>{row.invoiceNumber ?? '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Currency</span>
                <p>{row.currency}</p>
              </div>
              <div>
                <span className="text-gray-500">Issue date</span>
                <p>{formatDate(row.issueDate)}</p>
              </div>
              <div>
                <span className="text-gray-500">Due date</span>
                <p>{formatDate(row.dueDate)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Items</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600">
                      Description
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-600">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-600">
                      Unit price
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-600">
                      VAT
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-600">
                      Gross
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="px-4 py-2">{l.description}</td>
                      <td className="px-4 py-2 text-right">
                        {Number(l.quantity)} {l.unit}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {Number(l.unitPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-2 text-right">{l.vatRate}%</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {Number(l.grossAmount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50/50 text-sm">
                    <td className="px-4 py-2" colSpan={3}></td>
                    <td className="px-4 py-2 text-right text-gray-600">Net</td>
                    <td className="px-4 py-2 text-right">
                      {Number(row.netAmount).toFixed(2)} {row.currency}
                    </td>
                  </tr>
                  <tr className="bg-gray-50/50 text-sm">
                    <td className="px-4 py-2" colSpan={3}></td>
                    <td className="px-4 py-2 text-right text-gray-600">VAT</td>
                    <td className="px-4 py-2 text-right">
                      {Number(row.vatAmount).toFixed(2)} {row.currency}
                    </td>
                  </tr>
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-2" colSpan={3}></td>
                    <td className="px-4 py-2 text-right">Total</td>
                    <td className="px-4 py-2 text-right">
                      {Number(row.grossAmount).toFixed(2)} {row.currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>

          {row.status === 'confirmed' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500">Accounting</label>
                  <select
                    className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={row.accountingStatus}
                    onChange={(e) => {
                      if (isAccountingStatus(e.target.value))
                        handleAccounting(e.target.value);
                    }}
                  >
                    <option value="pending">Pending</option>
                    <option value="accounted">Accounted</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Payment</label>
                  <select
                    className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={row.paymentStatus}
                    onChange={(e) => {
                      if (isPaymentStatus(e.target.value))
                        handlePayment(e.target.value);
                    }}
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          {row.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm text-gray-700">
                {row.notes}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

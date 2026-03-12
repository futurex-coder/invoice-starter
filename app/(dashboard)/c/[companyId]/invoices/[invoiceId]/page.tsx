'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getInvoice, finalizeInvoice, cancelInvoice } from '@/src/features/bulgarian-invoicing/actions';
import { formatDocTypeLabel, formatInvoiceNumber, formatDateBg, formatMoney } from '@/src/features/bulgarian-invoicing/formatter';
import type { Invoice } from '@/lib/db/schema';
import type { User } from '@/lib/db/schema';
import { InvoicePrintPreview } from './InvoicePrintPreview';
import { ArrowLeft, Pencil, CheckCircle, Printer, XCircle, Loader2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  issued: 'Issued',
  cancelled: 'Cancelled',
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = params.companyId as string;
  const id = Number(params.invoiceId);
  const printMode = searchParams.get('print') === '1';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { data: currentUser } = useSWR<User>('/api/user', fetcher);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const res = await getInvoice(id);
      if (cancelled) return;
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.data) setInvoice(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleFinalize = async () => {
    setActionLoading(true);
    setError(null);
    const res = await finalizeInvoice(id);
    setActionLoading(false);
    if (res.error) setError(res.error);
    else if (res.data) setInvoice(res.data);
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this invoice? This cannot be undone.')) return;
    setActionLoading(true);
    setError(null);
    const res = await cancelInvoice(id);
    setActionLoading(false);
    if (res.error) setError(res.error);
    else if (res.data) setInvoice(res.data);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <section className="flex-1 p-4 lg:p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  if (error || !invoice) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <p className="text-red-600">{error ?? 'Invoice not found'}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href={`/c/${companyId}/invoices`}>Back to list</Link>
        </Button>
      </section>
    );
  }

  const totals = (invoice.totals ?? { totalGross: 0, totalNet: 0, totalVat: 0 }) as { totalGross: number; totalNet: number; totalVat: number };
  const recipient = (invoice.recipientSnapshot ?? {}) as { legalName?: string };
  const isDraft = invoice.status === 'draft';
  const isCancelled = invoice.status === 'cancelled';

  if (printMode) {
    return (
      <div className="p-4">
        <div className="invoice-print-document">
          <InvoicePrintPreview invoice={invoice} createdByName={currentUser?.name ?? currentUser?.email} />
        </div>
        <div className="mt-4 flex gap-2 no-print">
          <Button variant="outline" onClick={() => router.back()}>Back</Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/c/${companyId}/invoices`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg lg:text-2xl font-medium">
              {formatDocTypeLabel(invoice.docType)}
              {invoice.number != null ? ` № ${formatInvoiceNumber(invoice.number)}` : ` (Draft #${invoice.id})`}
            </h1>
            <p className="text-sm text-gray-500">
              {formatDateBg(invoice.issueDate)}
              {' · '}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                  isCancelled ? 'bg-gray-200' : isDraft ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                }`}
              >
                {STATUS_LABELS[invoice.status] ?? invoice.status}
              </span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/c/${companyId}/invoices/new?edit=${invoice.id}`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit draft
                </Link>
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleFinalize}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Finalize
              </Button>
            </>
          )}
          {!isCancelled && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/c/${companyId}/invoices/${invoice.id}?print=1`}>
                <Printer className="mr-2 h-4 w-4" />
                Print / Preview
              </Link>
            </Button>
          )}
          {!isDraft && !isCancelled && (
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={actionLoading}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel invoice
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Client</span>
            <span>{recipient.legalName ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Payment</span>
            <span>{invoice.paymentMethod} · {invoice.paymentStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total</span>
            <span className="font-medium">{formatMoney(totals.totalGross)} {invoice.currency}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Print preview</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <InvoicePrintPreview invoice={invoice} createdByName={currentUser?.name ?? currentUser?.email} />
          </div>
          <div className="p-4 border-t flex justify-end">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

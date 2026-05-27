'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getInvoice, finalizeInvoice, cancelInvoice, updateInvoicePaymentInfo } from '@/src/features/bulgarian-invoicing/actions';
import { formatDocTypeLabel, formatInvoiceNumber, formatDateBg, formatMoney } from '@/src/features/bulgarian-invoicing/formatter';
import {
  parseInvoiceTotalsStrict,
  parsePartySnapshotStrict,
} from '@/src/features/bulgarian-invoicing/parsers';
import type { Invoice } from '@/lib/db/schema';
import { InvoicePrintPreview } from './InvoicePrintPreview';
import { requireStringParam } from '@/lib/route-params';
import { ArrowLeft, Pencil, CheckCircle, Printer, XCircle, Loader2 } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Alert } from '@/components/ui/alert';
import { useCurrentUser } from '@/lib/swr/use-current-user';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  issued: 'Issued',
  cancelled: 'Cancelled',
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = requireStringParam(params, 'companyId');
  const id = Number(params.invoiceId);
  const printMode = searchParams.get('print') === '1';

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const { data: currentUser } = useCurrentUser();

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

  const handleCancelConfirmed = async () => {
    setActionLoading(true);
    setError(null);
    const res = await cancelInvoice(id);
    setActionLoading(false);
    if (res.error) {
      setError(res.error);
      throw new Error(res.error);
    }
    if (res.data) setInvoice(res.data);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </PageShell>
    );
  }

  if (error || !invoice) {
    return (
      <PageShell>
        <p className="text-red-600">{error ?? 'Invoice not found'}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href={`/c/${companyId}/invoices`}>Back to list</Link>
        </Button>
      </PageShell>
    );
  }

  const totals = parseInvoiceTotalsStrict(invoice.totals);
  const recipient = parsePartySnapshotStrict(invoice.recipientSnapshot);
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
    <PageShell maxWidth="4xl" className="mx-auto">
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
            <Button variant="outline" size="sm" onClick={() => setConfirmCancelOpen(true)} disabled={actionLoading}>
              <XCircle className="mr-2 h-4 w-4" />
              Cancel invoice
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
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
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Payment method</span>
            <span>{invoice.paymentMethod}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Payment status</span>
            {!isCancelled ? (
              <Select
                value={invoice.paymentStatus ?? 'unpaid'}
                disabled={actionLoading}
                onValueChange={async (v) => {
                  setActionLoading(true);
                  setError(null);
                  const res = await updateInvoicePaymentInfo(id, { paymentStatus: v });
                  setActionLoading(false);
                  if (res.error) setError(res.error);
                  else if (res.data) setInvoice(res.data);
                }}
              >
                <SelectTrigger className="h-8 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span>{invoice.paymentStatus}</span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Due date</span>
            {!isCancelled ? (
              <input
                type="date"
                className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                value={invoice.dueDate ?? ''}
                disabled={actionLoading}
                onChange={async (e) => {
                  setActionLoading(true);
                  setError(null);
                  const res = await updateInvoicePaymentInfo(id, { dueDate: e.target.value || null });
                  setActionLoading(false);
                  if (res.error) setError(res.error);
                  else if (res.data) setInvoice(res.data);
                }}
              />
            ) : (
              <span>{invoice.dueDate ? formatDateBg(invoice.dueDate) : '—'}</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total</span>
            <span className="font-medium">{formatMoney(totals.grossAmount)} {invoice.currency}</span>
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

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Cancel invoice?"
        description={
          invoice.number != null
            ? `Invoice № ${formatInvoiceNumber(invoice.number)} will be marked as cancelled. This cannot be undone — issue a credit note instead if you need to reverse it.`
            : 'This invoice will be marked as cancelled. This cannot be undone — issue a credit note instead if you need to reverse it.'
        }
        confirmText="Cancel invoice"
        cancelText="Keep invoice"
        variant="destructive"
        onConfirm={handleCancelConfirmed}
      />
    </PageShell>
  );
}

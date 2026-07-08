'use client';

import { useState } from 'react';
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
import { InvoicePrintPreview } from './InvoicePrintPreview';
import { requireStringParam } from '@/lib/route-params';
import { ArrowLeft, Pencil, CheckCircle, Printer, XCircle, Loader2 } from 'lucide-react';
import { PageShell } from '@/components/page-shell';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Alert } from '@/components/ui/alert';
import { useCurrentUser } from '@/lib/swr/use-current-user';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Чернова',
  finalized: 'Издадена',
  cancelled: 'Анулирана',
};
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank: 'Банков път',
  cash: 'В брой',
  barter: 'Бартер',
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Неплатена',
  partial: 'Частично',
  paid: 'Платена',
};

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = requireStringParam(params, 'companyId');
  const id = Number(params.invoiceId);
  const printMode = searchParams.get('print') === '1';

  const {
    data: invoice,
    isLoading: loading,
    error: fetchError,
    mutate,
  } = useActionSWR(['invoice', id], () => getInvoice(id));

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const { data: currentUser } = useCurrentUser();

  const error = actionError ?? (fetchError ? fetchError.message : null);

  const handleFinalize = async () => {
    setActionLoading(true);
    setActionError(null);
    const res = await finalizeInvoice(id);
    setActionLoading(false);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    if (res.data) mutate(res.data, { revalidate: false });
  };

  const handleCancelConfirmed = async () => {
    setActionLoading(true);
    setActionError(null);
    const res = await cancelInvoice(id);
    setActionLoading(false);
    if (res.error) {
      setActionError(res.error);
      throw new Error(res.error);
    }
    if (res.data) mutate(res.data, { revalidate: false });
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
        <p className="text-red-600">{error ?? 'Фактурата не е намерена'}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href={`/c/${companyId}/invoices`}>Назад към списъка</Link>
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
          <Button variant="outline" onClick={() => router.back()}>Назад</Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Печат
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageShell maxWidth="4xl" className="mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Назад към фактурите">
            <Link href={`/c/${companyId}/invoices`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg lg:text-2xl font-medium">
              {formatDocTypeLabel(invoice.docType)}
              {invoice.number != null ? ` № ${formatInvoiceNumber(invoice.number)}` : ` (Чернова #${invoice.id})`}
            </h1>
            <p className="text-sm text-gray-500">
              {formatDateBg(invoice.issueDate)}
              {' · '}
              <span
                className={cn(
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  isCancelled ? 'bg-gray-200' : isDraft ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                )}
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
                  Редактирай чернова
                </Link>
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleFinalize}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Издай
              </Button>
            </>
          )}
          {!isCancelled && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/c/${companyId}/invoices/${invoice.id}?print=1`}>
                <Printer className="mr-2 h-4 w-4" />
                Печат
              </Link>
            </Button>
          )}
          {!isDraft && !isCancelled && (
            <Button variant="outline" size="sm" onClick={() => setConfirmCancelOpen(true)} disabled={actionLoading}>
              <XCircle className="mr-2 h-4 w-4" />
              Анулирай фактурата
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
          <CardTitle>Обобщение</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Клиент</span>
            <span>{recipient.legalName ?? '—'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Начин на плащане</span>
            <span>{PAYMENT_METHOD_LABELS[invoice.paymentMethod ?? ''] ?? invoice.paymentMethod}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Статус на плащане</span>
            {!isCancelled ? (
              <Select
                value={invoice.paymentStatus ?? 'unpaid'}
                disabled={actionLoading}
                onValueChange={async (v) => {
                  setActionLoading(true);
                  setActionError(null);
                  const res = await updateInvoicePaymentInfo(id, { paymentStatus: v });
                  setActionLoading(false);
                  if (res.error) setActionError(res.error);
                  else if (res.data) mutate(res.data, { revalidate: false });
                }}
              >
                <SelectTrigger className="h-8 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Неплатена</SelectItem>
                  <SelectItem value="partial">Частично</SelectItem>
                  <SelectItem value="paid">Платена</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span>{PAYMENT_STATUS_LABELS[invoice.paymentStatus ?? ''] ?? invoice.paymentStatus}</span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Падеж</span>
            {!isCancelled ? (
              <input
                type="date"
                className="h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                value={invoice.dueDate ?? ''}
                disabled={actionLoading}
                onChange={async (e) => {
                  setActionLoading(true);
                  setActionError(null);
                  const res = await updateInvoicePaymentInfo(id, { dueDate: e.target.value || null });
                  setActionLoading(false);
                  if (res.error) setActionError(res.error);
                  else if (res.data) mutate(res.data, { revalidate: false });
                }}
              />
            ) : (
              <span>{invoice.dueDate ? formatDateBg(invoice.dueDate) : '—'}</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Общо</span>
            <span className="font-medium">{formatMoney(totals.grossAmount)} {invoice.currency}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Преглед за печат</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            <InvoicePrintPreview invoice={invoice} createdByName={currentUser?.name ?? currentUser?.email} />
          </div>
          <div className="p-4 border-t flex justify-end">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Печат
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmCancelOpen}
        onOpenChange={setConfirmCancelOpen}
        title="Анулиране на фактура?"
        description={
          invoice.number != null
            ? `Фактура № ${formatInvoiceNumber(invoice.number)} ще бъде маркирана като анулирана. Това действие е необратимо — вместо това издайте кредитно известие, ако трябва да я сторнирате.`
            : 'Тази фактура ще бъде маркирана като анулирана. Това действие е необратимо — вместо това издайте кредитно известие, ако трябва да я сторнирате.'
        }
        confirmText="Анулирай фактурата"
        cancelText="Запази фактурата"
        variant="destructive"
        onConfirm={handleCancelConfirmed}
      />
    </PageShell>
  );
}

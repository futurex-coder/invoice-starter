'use client';

/**
 * KONT-1 Slice 2 — „Меню Контиране“ (the Microinvest journalizing panel).
 *
 * Shows the derived double-entry статия for a finalized sale document: a header
 * (Контировка №, тип, операция по ДДС, контрагент, месец за експорт) and two
 * columns — Дебит on the left, Кредит on the right — with running totals and a
 * balance indicator. „Осчетоводи“ is gated on a balanced entry; once posted the
 * panel locks and offers „Сторнирай“ (which writes a reversing entry and unlocks
 * the source). Field/label wording follows docs/KONTIROVKA_MICROINVEST_NAMING.md.
 */

import { useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { formatMoney, formatDateBg } from '@/src/features/bulgarian-invoicing/formatter';
import {
  getInvoiceContraPreview,
  postInvoiceContra,
  reverseInvoiceContra,
} from '@/src/features/kontirovka/actions';
import type { ContraLine, AccountingBasis } from '@/src/features/kontirovka/contra';
import { BookCheck, Loader2, Scale, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const BASIS_LABELS: Record<AccountingBasis, string> = {
  services: 'Услуги',
  goods: 'Стоки',
  production: 'Продукция',
  materials: 'Материали',
  fixed_asset: 'Дълготрайни активи',
  other: 'Друго',
};

interface Props {
  companyId: string;
  invoiceId: number;
  currency: string;
  /** Called after a successful post/reverse so the parent can revalidate. */
  onChanged?: () => void;
}

function LedgerColumn({
  title,
  lines,
  total,
  currency,
  accent,
}: {
  title: string;
  lines: ContraLine[];
  total: number;
  currency: string;
  accent: 'debit' | 'credit';
}) {
  return (
    <div className="flex-1 rounded-lg border border-gray-200 overflow-hidden">
      <div
        className={cn(
          'px-3 py-2 text-xs font-semibold uppercase tracking-wide',
          accent === 'debit'
            ? 'bg-blue-50 text-blue-800'
            : 'bg-emerald-50 text-emerald-800'
        )}
      >
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {lines.length === 0 ? (
            <tr>
              <td className="px-3 py-2 text-gray-400" colSpan={2}>
                —
              </td>
            </tr>
          ) : (
            lines.map((l, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-3 py-2">
                  <span className="font-mono font-medium">{l.code}</span>
                  <span className="ml-2 text-gray-500">{l.name}</span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                  {formatMoney(l.amount)} {currency}
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t border-gray-200 bg-gray-50 font-medium">
            <td className="px-3 py-2 text-gray-600">Общо</td>
            <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
              {formatMoney(total)} {currency}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export function ContiranePanel({ companyId, invoiceId, currency, onChanged }: Props) {
  const {
    data: preview,
    isLoading,
    error: fetchError,
    mutate,
  } = useActionSWR(['contraPreview', companyId, invoiceId], () =>
    getInvoiceContraPreview(invoiceId)
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReverseOpen, setConfirmReverseOpen] = useState(false);

  const handlePost = async () => {
    setBusy(true);
    setActionError(null);
    const res = await postInvoiceContra(invoiceId);
    setBusy(false);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    await mutate();
    onChanged?.();
  };

  const handleReverseConfirmed = async () => {
    setBusy(true);
    setActionError(null);
    const res = await reverseInvoiceContra(invoiceId);
    setBusy(false);
    if (res.error) {
      setActionError(res.error);
      throw new Error(res.error);
    }
    await mutate();
    onChanged?.();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Контиране</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (fetchError || !preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Контиране</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="error">
            {fetchError ? fetchError.message : 'Контировката не може да се зареди'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const debitLines = preview.lines.filter((l) => l.side === 'debit');
  const creditLines = preview.lines.filter((l) => l.side === 'credit');
  const posted = preview.alreadyPosted;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          Меню Контиране
          {posted ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              Осчетоводена · Контировка № {preview.postingNumber}
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                preview.balanced
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-red-100 text-red-700'
              )}
            >
              <Scale className="h-3 w-3" />
              {preview.balanced ? 'Балансирана' : 'Небалансирана'}
            </span>
          )}
        </CardTitle>
        {posted ? (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => setConfirmReverseOpen(true)}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Undo2 className="mr-2 h-4 w-4" />
            )}
            Сторнирай
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-green-600 hover:bg-green-700"
            onClick={handlePost}
            disabled={busy || !preview.balanced}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <BookCheck className="mr-2 h-4 w-4" />
            )}
            Осчетоводи
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {actionError && <Alert variant="error">{actionError}</Alert>}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Field label="Тип на документа">{preview.documentType}</Field>
          <Field label="Документ №">{preview.documentNumber}</Field>
          <Field label="Дата (данъчно събитие)">
            {formatDateBg(preview.documentDate)}
          </Field>
          <Field label="Контрагент">
            {preview.partnerName || '—'}
            {preview.partnerUic ? (
              <span className="text-gray-400"> · {preview.partnerUic}</span>
            ) : null}
          </Field>
          <Field label="Операция по ДДС">{preview.vatOperationLabel}</Field>
          <Field label="Основание">{BASIS_LABELS[preview.basis]}</Field>
          <Field label="Месец за експорт">{preview.vatPeriod}</Field>
          {preview.vies ? (
            <Field label="VIES">
              <span className="inline-flex items-center rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-800">
                Да
              </span>
            </Field>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <LedgerColumn
            title="Дебит"
            lines={debitLines}
            total={preview.totalDebit}
            currency={currency}
            accent="debit"
          />
          <LedgerColumn
            title="Кредит"
            lines={creditLines}
            total={preview.totalCredit}
            currency={currency}
            accent="credit"
          />
        </div>

        {!posted && !preview.balanced && (
          <p className="text-sm text-red-600">
            Контировката не е балансирана (Дебит {formatMoney(preview.totalDebit)}{' '}
            {currency} ≠ Кредит {formatMoney(preview.totalCredit)} {currency}) —
            осчетоводяването е блокирано.
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmReverseOpen}
        onOpenChange={setConfirmReverseOpen}
        title="Сторниране на контировка?"
        description={`Контировка № ${preview.postingNumber} ще бъде сторнирана с обратна статия. Документът ще се отключи и ще може да се осчетоводи наново. Оригиналната контировка остава в дневника (одитна следа).`}
        confirmText="Сторнирай"
        cancelText="Отказ"
        variant="destructive"
        onConfirm={handleReverseConfirmed}
      />
    </Card>
  );
}

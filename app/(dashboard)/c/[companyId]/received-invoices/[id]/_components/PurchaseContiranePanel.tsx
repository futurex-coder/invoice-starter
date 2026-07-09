'use client';

/**
 * KONT-1 Slice 3 — „Меню Контиране" for a purchase (received invoice). Renders the
 * shared <KontirovkaForm>, plus the two classifications a purchase needs and a sale
 * doesn't, in the Основание position: the basis (→ 60x/30x/204/304) and whether the
 * input VAT is deductible (пълен кредит vs чл.70 без право). Changing either
 * re-derives the preview; „Осчетоводи" posts with the chosen classification. Once
 * posted the panel locks to what was booked and offers „Сторнирай". `onCancel`
 * adds an „Отказ" button when opened inside the ДДС-дневник dialog.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { formatDateBg } from '@/src/features/bulgarian-invoicing/formatter';
import {
  getReceivedInvoiceContraPreview,
  postReceivedInvoiceContra,
  reverseReceivedInvoiceContra,
} from '@/src/features/kontirovka/actions';
import type { AccountingBasis } from '@/src/features/kontirovka/contra';
import {
  DEAL_TYPE_LABELS,
  getViesLabel,
} from '@/src/features/kontirovka/vat-operations';
import {
  formatPostingNumber,
  formatExportMonth,
} from '@/src/features/kontirovka/format';
import { BASIS_LABELS, ContraField } from '@/components/kontirovka/contra-ledger';
import { KontirovkaForm } from '@/components/kontirovka/KontirovkaForm';
import { BookCheck, Loader2, Scale, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  companyId: string;
  receivedInvoiceId: number;
  currency: string;
  /** Called after a successful post/reverse so the parent can revalidate. */
  onChanged?: () => void;
  /** When provided (dialog mode), renders an „Отказ" button. */
  onCancel?: () => void;
}

export function PurchaseContiranePanel({
  companyId,
  receivedInvoiceId,
  currency,
  onChanged,
  onCancel,
}: Props) {
  const [basis, setBasis] = useState<AccountingBasis>('services');
  const [noCredit, setNoCredit] = useState(false);

  const {
    data: preview,
    isLoading,
    error: fetchError,
    mutate,
  } = useActionSWR(
    ['receivedContraPreview', companyId, receivedInvoiceId, basis, noCredit],
    () => getReceivedInvoiceContraPreview(receivedInvoiceId, { basis, noCredit })
  );

  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReverseOpen, setConfirmReverseOpen] = useState(false);

  const handlePost = async () => {
    setBusy(true);
    setActionError(null);
    const res = await postReceivedInvoiceContra(receivedInvoiceId, { basis, noCredit });
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
    const res = await reverseReceivedInvoiceContra(receivedInvoiceId);
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
  const canPost = preview.hasVat && preview.balanced && !posted;
  // When posted, the pickers reflect what was actually booked (server override).
  const shownBasis = posted ? preview.basis : basis;
  const shownNoCredit = posted ? preview.noCredit : noCredit;

  // Основание + чл.70 render in the Основание position of the shared form.
  const classificationSlot = (
    <>
      <ContraField label="Основание">
        <Select
          value={shownBasis}
          disabled={posted || busy || !preview.hasVat}
          onValueChange={(v) => {
            if (isBasis(v)) setBasis(v);
          }}
        >
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {preview.basisOptions.map((b) => (
              <SelectItem key={b} value={b}>
                {BASIS_LABELS[b]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ContraField>
      <label
        className={cn(
          'flex items-center gap-2 border-b border-gray-100 py-1.5 text-sm',
          (posted || !preview.hasVat) && 'opacity-60'
        )}
      >
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300"
          checked={shownNoCredit}
          disabled={posted || busy || !preview.hasVat}
          onChange={(e) => setNoCredit(e.target.checked)}
        />
        Без право на данъчен кредит (чл.70)
      </label>
    </>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          Меню Контиране
          {posted ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              Осчетоводена · Контировка № {preview.postingNumber}
            </span>
          ) : preview.hasVat ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                preview.balanced ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'
              )}
            >
              <Scale className="h-3 w-3" />
              {preview.balanced ? 'Балансирана' : 'Небалансирана'}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {actionError && <Alert variant="error">{actionError}</Alert>}

        {!preview.hasVat && (
          <Alert variant="warning">
            Покупка без ДДС — автоматичното осчетоводяване предстои в следващ етап.
          </Alert>
        )}

        <KontirovkaForm
          header={{
            postingNumberLabel: formatPostingNumber(preview.postingNumber),
            postingDateLabel: preview.postingDate
              ? formatDateBg(preview.postingDate)
              : '—',
            documentType: preview.documentType,
            documentNumber: preview.documentNumber,
            documentDateLabel: preview.documentDate
              ? formatDateBg(preview.documentDate)
              : '—',
            partnerName: preview.partnerName,
            partnerUic: preview.partnerUic,
            partnerLabel: 'Доставчик',
            basisLabel: BASIS_LABELS[preview.basis],
            note: preview.note,
            dealTypeLabel: DEAL_TYPE_LABELS[preview.dealType],
            vatOperationLabel: preview.vatOperationLabel,
            viesLabel: getViesLabel(preview.vies),
            exportMonthLabel: formatExportMonth(preview.vatPeriod),
          }}
          debitLines={debitLines}
          creditLines={creditLines}
          currency={currency}
          totalDebit={preview.totalDebit}
          totalCredit={preview.totalCredit}
          classificationSlot={classificationSlot}
        />

        <div className="flex items-center justify-end gap-2 pt-1">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
              Отказ
            </Button>
          )}
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
              disabled={busy || !canPost}
            >
              {busy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <BookCheck className="mr-2 h-4 w-4" />
              )}
              Осчетоводи
            </Button>
          )}
        </div>
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

function isBasis(v: string): v is AccountingBasis {
  return (
    v === 'services' ||
    v === 'goods' ||
    v === 'production' ||
    v === 'materials' ||
    v === 'fixed_asset' ||
    v === 'other'
  );
}

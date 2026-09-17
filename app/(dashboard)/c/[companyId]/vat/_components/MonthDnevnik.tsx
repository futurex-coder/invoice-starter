'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { getDnevnikForMonth } from '@/src/features/kontirovka/actions';
import { getVatOperationMeta } from '@/src/features/kontirovka/vat-operations';
import {
  formatMoney,
  formatInvoiceNumber,
  formatDateBg,
} from '@/src/features/bulgarian-invoicing/formatter';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ContiranePanel } from '@/app/(dashboard)/c/[companyId]/invoices/[invoiceId]/_components/ContiranePanel';
import { PurchaseContiranePanel } from '@/app/(dashboard)/c/[companyId]/received-invoices/[id]/_components/PurchaseContiranePanel';

/** A document whose Меню Контиране can be opened from a дневник row. */
type DocRef = { kind: 'sale'; id: number; currency: string } | { kind: 'purchase'; id: number; currency: string };

interface DisplayRow {
  key: string;
  /** the document this row points to (opens its Меню Контиране) */
  ref: DocRef;
  docNo: string;
  isNote: boolean;
  date: string;
  name: string;
  eik: string;
  netBase: number;
  vatBase: number;
  vatRate: number;
  opLabel: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function LedgerTable({
  title,
  rows,
  baseCurrency,
  emptyText,
  onOpen,
}: {
  title: string;
  rows: DisplayRow[];
  baseCurrency: string;
  emptyText: string;
  onOpen: (ref: DocRef) => void;
}) {
  const totalNet = round2(rows.reduce((s, r) => s + r.netBase, 0));
  const totalVat = round2(rows.reduce((s, r) => s + r.vatBase, 0));
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <span className="text-xs text-gray-500">
          {rows.length} {rows.length === 1 ? 'документ' : 'документа'}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-4 text-sm text-gray-500">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-1.5">Документ</th>
                <th className="px-3 py-1.5">Контрагент</th>
                <th className="px-3 py-1.5 text-right">Основа</th>
                <th className="px-3 py-1.5 text-right">ДДС</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Отвори контировка за ${r.docNo}`}
                  onClick={() => onOpen(r.ref)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpen(r.ref);
                    }
                  }}
                  className="cursor-pointer border-b border-gray-100 last:border-0 hover:bg-sky-50/60 focus:bg-sky-50 focus:outline-none"
                >
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">
                      {r.docNo}
                      {r.isNote && (
                        <span className="ml-1.5 inline-flex rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-700">
                          КИ/ДИ
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{r.date}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="max-w-[220px] truncate">{r.name}</div>
                    <div className="text-xs text-gray-500">
                      {r.eik ? `ЕИК ${r.eik} · ` : ''}
                      {r.opLabel}
                      {r.vatRate > 0 ? ` · ${r.vatRate}%` : ''}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right align-top tabular-nums">
                    {formatMoney(r.netBase)}
                  </td>
                  <td className="px-3 py-2 text-right align-top tabular-nums">
                    {formatMoney(r.vatBase)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300 font-medium">
                <td className="px-3 py-2" colSpan={2}>
                  Общо ({baseCurrency})
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(totalNet)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMoney(totalVat)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * The per-document ДДС дневник (продажби + покупки) for one month, shown when a
 * VAT-page month row is expanded. Read-only (Slice 1); Σ reconciles to the
 * month's ДДС продажби / покупки on the parent row.
 */
export function MonthDnevnik({
  companyId,
  month,
  baseCurrency,
}: {
  companyId: string;
  month: string;
  baseCurrency: string;
}) {
  const { data, isLoading, error, mutate } = useActionSWR(
    ['dnevnik', companyId, month],
    () => getDnevnikForMonth(month)
  );
  const [selected, setSelected] = useState<DocRef | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }
  if (error) {
    return <ErrorAlert message={error.message} className="m-3" />;
  }

  const salesRows: DisplayRow[] = (data?.sales ?? []).map((r) => ({
    key: `s${r.id}`,
    ref: { kind: 'sale', id: r.id, currency: r.currency },
    docNo: r.number != null ? formatInvoiceNumber(r.number) : `#${r.id}`,
    isNote: r.docType === 'credit_note' || r.docType === 'debit_note',
    date: formatDateBg(r.issueDate),
    name: r.partnerName ?? '—',
    eik: r.partnerEik ?? '',
    netBase: r.netBase,
    vatBase: r.vatBase,
    vatRate: r.vatRate,
    opLabel: getVatOperationMeta(r.vatOperation).label,
  }));

  const purchaseRows: DisplayRow[] = (data?.purchases ?? []).map((r) => ({
    key: `p${r.id}`,
    ref: { kind: 'purchase', id: r.id, currency: r.currency },
    docNo: r.invoiceNumber ?? `#${r.id}`,
    isNote: false,
    date: r.issueDate ? formatDateBg(r.issueDate) : '—',
    name: r.supplierName ?? '—',
    eik: r.supplierEik ?? '',
    netBase: r.netBase,
    vatBase: r.vatBase,
    vatRate: r.vatRate,
    opLabel: getVatOperationMeta(r.vatOperation).label,
  }));

  return (
    <div className="space-y-4 bg-gray-50/60 p-4">
      {data?.postedVat ? (
        <PostedVatStrip postedVat={data.postedVat} baseCurrency={baseCurrency} />
      ) : null}
      <p className="text-xs text-gray-500">
        Натиснете върху документ, за да отворите неговата контировка (Меню
        Контиране).
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <LedgerTable
          title="Дневник продажби"
          rows={salesRows}
          baseCurrency={baseCurrency}
          emptyText="Няма продажби за месеца."
          onOpen={setSelected}
        />
        <LedgerTable
          title="Дневник покупки"
          rows={purchaseRows}
          baseCurrency={baseCurrency}
          emptyText="Няма покупки за месеца."
          onOpen={setSelected}
        />
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="sr-only">Меню Контиране</DialogTitle>
          <DialogDescription className="sr-only">
            Осчетоводяване на документа — дебит/кредит контировка.
          </DialogDescription>
          {selected?.kind === 'sale' ? (
            <ContiranePanel
              companyId={companyId}
              invoiceId={selected.id}
              currency={selected.currency}
              onChanged={() => mutate()}
              onCancel={() => setSelected(null)}
            />
          ) : selected?.kind === 'purchase' ? (
            <PurchaseContiranePanel
              companyId={companyId}
              receivedInvoiceId={selected.id}
              currency={selected.currency}
              onChanged={() => mutate()}
              onCancel={() => setSelected(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * The REAL VAT for the month from posted контировки — distinct from the accrual
 * Прогноза on the parent row. Shows изходящ − входящ = нето (за внасяне /
 * възстановяване) plus how many documents are already осчетоводени.
 */
function PostedVatStrip({
  postedVat,
  baseCurrency,
}: {
  postedVat: {
    outputVat: number;
    inputVat: number;
    netVat: number;
    salesCount: number;
    purchasesCount: number;
  };
  baseCurrency: string;
}) {
  const { outputVat, inputVat, netVat, salesCount, purchasesCount } = postedVat;
  const nothingPosted = salesCount === 0 && purchasesCount === 0;
  const payable = netVat >= 0;
  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-emerald-900">
          Осчетоводен ДДС (реален)
        </h4>
        <span className="text-xs text-emerald-700">
          {salesCount + purchasesCount} осчетоводени документа
        </span>
      </div>
      {nothingPosted ? (
        <p className="text-sm text-emerald-800/80">
          Още няма осчетоводени контировки за месеца — числата горе са прогноза.
          Осчетоводете фактурите, за да видите реалния ДДС.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-emerald-700">Изходящ ДДС (продажби)</div>
            <div className="font-medium tabular-nums">
              {formatMoney(outputVat)} {baseCurrency}
            </div>
          </div>
          <div>
            <div className="text-xs text-emerald-700">Входящ ДДС (покупки)</div>
            <div className="font-medium tabular-nums">
              {formatMoney(inputVat)} {baseCurrency}
            </div>
          </div>
          <div>
            <div className="text-xs text-emerald-700">
              {payable ? 'ДДС за внасяне' : 'ДДС за възстановяване'}
            </div>
            <div className="font-semibold tabular-nums text-emerald-900">
              {formatMoney(Math.abs(netVat))} {baseCurrency}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

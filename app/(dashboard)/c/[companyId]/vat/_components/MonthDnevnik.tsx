'use client';

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

interface DisplayRow {
  key: string;
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
}: {
  title: string;
  rows: DisplayRow[];
  baseCurrency: string;
  emptyText: string;
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
                <tr key={r.key} className="border-b border-gray-100 last:border-0">
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
  month,
  baseCurrency,
}: {
  month: string;
  baseCurrency: string;
}) {
  const { data, isLoading, error } = useActionSWR(['dnevnik', month], () =>
    getDnevnikForMonth(month)
  );

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
    <div className="grid gap-4 bg-gray-50/60 p-4 lg:grid-cols-2">
      <LedgerTable
        title="Дневник продажби"
        rows={salesRows}
        baseCurrency={baseCurrency}
        emptyText="Няма продажби за месеца."
      />
      <LedgerTable
        title="Дневник покупки"
        rows={purchaseRows}
        baseCurrency={baseCurrency}
        emptyText="Няма покупки за месеца."
      />
    </div>
  );
}

'use client';

/**
 * Shared presentational pieces for the „Меню Контиране" panels (sales + purchase):
 * a labelled form field, the Дебит/Кредит ledger column (3 columns, Microinvest
 * style: сметка | Описание | Сума with a labelled Общо foot), and the Основание
 * labels. Both panels render these through <KontirovkaForm> so they look identical.
 */

import type { ReactNode } from 'react';
import type { ContraLine, AccountingBasis } from '@/src/features/kontirovka/contra';
import { formatMoney } from '@/src/features/bulgarian-invoicing/formatter';
import { cn } from '@/lib/utils';

export const BASIS_LABELS: Record<AccountingBasis, string> = {
  services: 'Услуги',
  goods: 'Стоки',
  production: 'Продукция',
  materials: 'Материали',
  fixed_asset: 'Дълготрайни активи',
  other: 'Друго',
};

/** A Microinvest-style header row: label on the left, value on the right. */
export function ContraField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] items-center gap-3 border-b border-gray-100 py-1.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="min-w-0 text-sm">{children}</span>
    </div>
  );
}

export function LedgerColumn({
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
  const totalLabel = accent === 'debit' ? 'Общо Дебит' : 'Общо Кредит';
  return (
    <div className="flex-1 overflow-hidden rounded-lg border border-gray-200">
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
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-400">
              <th className="w-20 px-3 py-1.5 font-medium">Сметка</th>
              <th className="px-3 py-1.5 font-medium">Описание</th>
              <th className="px-3 py-1.5 text-right font-medium">Сума</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td className="px-3 py-2 text-gray-400" colSpan={3}>
                  —
                </td>
              </tr>
            ) : (
              lines.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-3 py-2 align-top font-mono font-medium">
                    {l.code}
                  </td>
                  <td className="px-3 py-2 align-top text-gray-600">{l.name}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular-nums">
                    {formatMoney(l.amount)} {currency}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50 font-medium">
              <td className="px-3 py-2 text-gray-600" colSpan={2}>
                {totalLabel}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                {formatMoney(total)} {currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

'use client';

/**
 * Shared presentational pieces for the „Меню Контиране“ panels (sales + purchase):
 * the Дебит/Кредит ledger column, a labelled field, and the Основание labels.
 * Keeps both panels visually identical; each panel owns its own data + actions.
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

export function ContraField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm">{children}</span>
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

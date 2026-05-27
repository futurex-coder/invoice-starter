'use client';

import Link from 'next/link';
import { AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaymentRow } from '@/src/features/received-invoices/actions';
import type { PaymentStatus } from '@/src/features/received-invoices/types';
import { formatDate, formatMoney } from '@/lib/format';

interface Props {
  rows: PaymentRow[];
  companyId: string;
  kind: 'toPay' | 'paid';
  pendingId: number | null;
  onMark: (id: number, status: PaymentStatus) => void;
  overdueIds: Set<number>;
}

const HEADER_CELL =
  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600';

export function PaymentTable({
  rows,
  companyId,
  kind,
  pendingId,
  onMark,
  overdueIds,
}: Props) {
  const isToPay = kind === 'toPay';
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50/80">
          <th className="w-8 px-2 py-3" />
          <th className={HEADER_CELL}>Supplier</th>
          <th className={HEADER_CELL}>Number</th>
          <th className={HEADER_CELL}>Issue date</th>
          {isToPay && <th className={HEADER_CELL}>Due date</th>}
          <th className={`${HEADER_CELL} text-right`}>Amount</th>
          {isToPay && <th className={HEADER_CELL}>Status</th>}
          <th className={`${HEADER_CELL} text-right`}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const overdue = overdueIds.has(row.id);
          return (
            <tr
              key={row.id}
              className={`border-b border-gray-200 ${
                overdue ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-gray-50/50'
              }`}
            >
              <td className="px-2 py-3">
                <a
                  href={`/api/received-invoices/${row.id}/file?redirect=1`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  title="Open original file"
                  aria-label="Open original file"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </td>
              <td className="px-4 py-3 text-sm">
                {row.partnerName ?? row.supplierLegalName ?? '—'}
              </td>
              <td className="px-4 py-3 text-sm">
                {row.invoiceNumber ?? <span className="text-gray-400">—</span>}
              </td>
              <td className="px-4 py-3 text-sm">{formatDate(row.issueDate)}</td>
              {isToPay && (
                <td className="px-4 py-3 text-sm">
                  {overdue ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      {formatDate(row.dueDate)} · overdue
                    </span>
                  ) : (
                    formatDate(row.dueDate)
                  )}
                </td>
              )}
              <td className="px-4 py-3 text-right text-sm font-medium">
                {formatMoney(Number(row.grossAmount))} {row.currency}
              </td>
              {isToPay && (
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                      row.paymentStatus === 'partial'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {row.paymentStatus}
                  </span>
                </td>
              )}
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  {isToPay ? (
                    <>
                      {row.paymentStatus === 'unpaid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingId === row.id}
                          onClick={() => onMark(row.id, 'partial')}
                          className="h-7 text-xs"
                        >
                          Partial
                        </Button>
                      )}
                      <Button
                        size="sm"
                        disabled={pendingId === row.id}
                        onClick={() => onMark(row.id, 'paid')}
                        className="h-7 bg-green-600 text-xs hover:bg-green-700"
                      >
                        {pendingId === row.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Mark paid'
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pendingId === row.id}
                      onClick={() => onMark(row.id, 'unpaid')}
                      className="h-7 text-xs"
                      title="Mark as unpaid (in case of mistake)"
                    >
                      Undo
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost" className="h-7">
                    <Link
                      href={`/c/${companyId}/received-invoices/${row.id}`}
                      className="text-xs"
                    >
                      Open →
                    </Link>
                  </Button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

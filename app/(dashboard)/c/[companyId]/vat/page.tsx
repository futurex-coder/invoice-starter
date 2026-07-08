'use client';

import { useParams } from 'next/navigation';
import { Loader2, Calculator } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getVatSummary } from '@/src/features/bulgarian-invoicing/actions';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { requireStringParam } from '@/lib/route-params';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { DataTableHead, DATA_ROW_CLASS } from '@/components/list-page/DataTableHead';
import { formatMoney } from '@/src/features/bulgarian-invoicing/formatter';
import { PageShell } from '@/components/page-shell';
import { cn } from '@/lib/utils';

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);

function monthLabel(iso: string): string {
  const [y, m] = iso.split('-');
  const names = [
    'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
    'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
  ];
  const idx = Number(m) - 1;
  return names[idx] ? `${names[idx]} ${y}` : iso;
}

export default function VatPage() {
  const params = useParams();
  requireStringParam(params, 'companyId');

  const { data, isLoading, error } = useActionSWR('vatSummary', () =>
    getVatSummary({ months: 12 })
  );

  const rows = data ?? [];
  const hasMixedCurrencies = new Set(rows.map((r) => r.currency)).size > 1;

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-lg font-medium lg:text-2xl">
          <Calculator className="h-6 w-6" />
          ДДС / VAT
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          ДДС по издадени срещу получени документи, по месец на издаване
          (начислен — всички финализирани документи; кредитните известия се
          приспадат). Положително нето = дължимо към НАП.
        </p>
      </div>

      <ErrorAlert message={error ? error.message : null} className="mb-4" />

      {hasMixedCurrencies && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Документите са в повече от една валута — редовете са по валута;
          сумите не се преизчисляват към базова валута (предстои с
          валутната конверсия).
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Последни 12 месеца</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              Няма финализирани или потвърдени документи за периода.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <DataTableHead
                  columns={[
                    { label: 'Месец' },
                    { label: 'Валута' },
                    { label: 'ДДС продажби', align: 'right' },
                    { label: 'ДДС покупки', align: 'right' },
                    { label: 'Нето за НАП', align: 'right' },
                  ]}
                />
                <tbody>
                  {rows.map((r) => {
                    const isCurrent = r.month === CURRENT_MONTH;
                    return (
                      <tr
                        key={`${r.month}|${r.currency}`}
                        className={cn(
                          DATA_ROW_CLASS,
                          isCurrent && 'bg-amber-50/60'
                        )}
                      >
                        <td className="px-4 py-3 text-sm font-medium">
                          {monthLabel(r.month)}
                          {isCurrent && (
                            <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                              текущ
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">{r.currency}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          {formatMoney(r.vatIssued)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">
                          {formatMoney(r.vatPaid)}
                        </td>
                        <td
                          className={cn(
                            'px-4 py-3 text-right text-sm font-semibold',
                            r.vatNet > 0
                              ? 'text-red-700'
                              : r.vatNet < 0
                                ? 'text-green-700'
                                : 'text-gray-500'
                          )}
                        >
                          {formatMoney(r.vatNet)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

'use client';

import { useState, Fragment } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Calculator, ChevronRight, ChevronLeft } from 'lucide-react';
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
import { MonthDnevnik } from './_components/MonthDnevnik';
import { buildMonthGrid } from './_components/month-grid';

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH = NOW.toISOString().slice(0, 7);
const MONTH_NAMES = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември',
];

function monthLabel(iso: string): string {
  const [, m] = iso.split('-');
  const idx = Number(m) - 1;
  return MONTH_NAMES[idx] ?? iso;
}

export default function VatPage() {
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [expanded, setExpanded] = useState<string | null>(null);

  // companyId in the key isolates the cache per company (else SWR would serve
  // one company's VAT summary on another's page).
  const { data, isLoading, error } = useActionSWR(
    ['vatSummary', companyId, year],
    () => getVatSummary({ year })
  );
  const baseCurrency = data?.baseCurrency ?? 'EUR';

  // Full month grid for the year (descending), zero-filled so no month is ever
  // "missing". The current year stops at the current month (no future rows).
  const months = buildMonthGrid(
    year,
    CURRENT_YEAR,
    NOW.getMonth() + 1,
    data?.rows ?? []
  );

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
          приспадат). Положително нето = дължимо към НАП. Разгънете месец за
          разбивка по документи.
        </p>
      </div>

      <ErrorAlert message={error ? error.message : null} className="mb-4" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>ДДС по месеци</CardTitle>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              aria-label="Предходна година"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[4.5rem] text-center text-sm font-semibold">
              {year} г.
            </span>
            <button
              type="button"
              onClick={() => setYear((y) => Math.min(y + 1, CURRENT_YEAR))}
              disabled={year >= CURRENT_YEAR}
              aria-label="Следваща година"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : months.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">
              Няма данни за избрания период.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <DataTableHead
                  columns={[
                    { label: 'Месец' },
                    { label: `ДДС продажби (${baseCurrency})`, align: 'right' },
                    { label: `ДДС покупки (${baseCurrency})`, align: 'right' },
                    { label: `Нето за НАП (${baseCurrency})`, align: 'right' },
                  ]}
                />
                <tbody>
                  {months.map((r) => {
                    const isCurrent = r.month === CURRENT_MONTH;
                    const isOpen = expanded === r.month;
                    const isEmpty =
                      r.vatIssued === 0 && r.vatPaid === 0 && r.vatNet === 0;
                    return (
                      <Fragment key={r.month}>
                        <tr
                          className={cn(
                            DATA_ROW_CLASS,
                            'cursor-pointer',
                            isCurrent && 'bg-amber-50/60',
                            isEmpty && 'text-gray-400'
                          )}
                          onClick={() => setExpanded(isOpen ? null : r.month)}
                          aria-expanded={isOpen}
                        >
                          <td className="px-4 py-3 text-sm font-medium">
                            <ChevronRight
                              className={cn(
                                'mr-1.5 inline h-3.5 w-3.5 text-gray-400 transition-transform',
                                isOpen && 'rotate-90'
                              )}
                            />
                            {monthLabel(r.month)}
                            {isCurrent && (
                              <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                текущ
                              </span>
                            )}
                          </td>
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
                                  : 'text-gray-400'
                            )}
                          >
                            {formatMoney(r.vatNet)}
                          </td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={4} className="p-0">
                              <MonthDnevnik
                                companyId={companyId}
                                month={r.month}
                                baseCurrency={baseCurrency}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
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

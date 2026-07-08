'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CheckCircle2, Clock, CreditCard } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getPaymentsOverview,
  setReceivedInvoicePaymentStatus,
} from '@/src/features/received-invoices/actions';
import type { PaymentStatus } from '@/src/features/received-invoices/types';
import { useListPageState } from '@/lib/swr/use-list-page-state';
import { requireStringParam } from '@/lib/route-params';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { PaymentKpiGrid } from './_components/PaymentKpiGrid';
import { PaymentDateFilters } from './_components/PaymentDateFilters';
import { PaymentTable } from './_components/PaymentTable';
import {
  PaymentLoadingRow,
  PaymentEmptyRow,
} from './_components/PaymentSectionStates';
import { isOverdue, ninetyDaysAgo } from './_components/utils';
import { PageShell } from '@/components/page-shell';

// Date filters owned by useListPageState (URL-string-typed).
type PaymentsFilterState = {
  paidFromDate: string;
  paidToDate: string;
};

export default function PaymentsPage() {
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');

  // ninetyDaysAgo() is computed once at mount via the lazy defaults object.
  const defaults = useMemo<PaymentsFilterState>(
    () => ({ paidFromDate: ninetyDaysAgo(), paidToDate: '' }),
    []
  );

  const list = useListPageState({
    swrKey: 'paymentsOverview',
    defaults,
    action: ({ paidFromDate, paidToDate }) =>
      getPaymentsOverview({
        paidFromDate: paidFromDate || undefined,
        paidToDate: paidToDate || undefined,
      }),
  });

  const data = list.result;

  const [pendingId, setPendingId] = useState<number | null>(null);

  const overdueIds = useMemo(
    () => new Set((data?.toPay ?? []).filter((r) => isOverdue(r.dueDate)).map((r) => r.id)),
    [data]
  );

  const setStatus = async (id: number, value: PaymentStatus) => {
    setPendingId(id);
    try {
      await list.runMutation(() => setReceivedInvoicePaymentStatus(id, value));
    } catch {
      // list.runMutation already set actionError.
    } finally {
      setPendingId(null);
    }
  };

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-lg font-medium lg:text-2xl">
          <CreditCard className="h-5 w-5" />
          Плащания
        </h1>
        <p className="text-sm text-gray-500">
          Какво дължи фирмата и какво вече е платила. Тук се броят само
          потвърдените получени фактури — черновите са все още в{' '}
          <Link
            href={`/c/${companyId}/received-invoices`}
            className="text-primary/90 hover:underline"
          >
            получени фактури
          </Link>
          .
        </p>
      </div>

      <ErrorAlert message={list.error} className="mb-4" />

      <PaymentKpiGrid totals={data?.totals} loading={list.loading} />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-rose-600" />
            За плащане
            {data && (
              <span className="text-xs font-normal text-gray-500">
                ({data.toPay.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {list.loading ? (
            <PaymentLoadingRow />
          ) : !data?.toPay.length ? (
            <PaymentEmptyRow text="Няма нищо за плащане. Всичко е изрядно." accent="green" />
          ) : (
            <PaymentTable
              rows={data.toPay}
              companyId={companyId}
              kind="toPay"
              pendingId={pendingId}
              onMark={setStatus}
              overdueIds={overdueIds}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-end justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-purple-600" />
            Платени
            {data && (
              <span className="text-xs font-normal text-gray-500">
                ({data.paid.length})
              </span>
            )}
          </CardTitle>
          <PaymentDateFilters
            fromDate={list.filters.paidFromDate}
            onFromDateChange={(v) => list.setFilter('paidFromDate', v)}
            toDate={list.filters.paidToDate}
            onToDateChange={(v) => list.setFilter('paidToDate', v)}
            onClear={() => {
              list.setFilter('paidFromDate', '');
              list.setFilter('paidToDate', '');
            }}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {list.loading ? (
            <PaymentLoadingRow />
          ) : !data?.paid.length ? (
            <PaymentEmptyRow text="Няма платени фактури в този период." accent="gray" />
          ) : (
            <PaymentTable
              rows={data.paid}
              companyId={companyId}
              kind="paid"
              pendingId={pendingId}
              onMark={setStatus}
              overdueIds={new Set()}
            />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}

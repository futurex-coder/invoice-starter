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
import { useActionSWR } from '@/lib/swr/use-action-swr';
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

export default function PaymentsPage() {
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');

  const [paidFromDate, setPaidFromDate] = useState(ninetyDaysAgo());
  const [paidToDate, setPaidToDate] = useState('');
  const [pendingId, setPendingId] = useState<number | null>(null);

  const {
    data,
    isLoading: loading,
    error: fetchError,
    mutate: refetch,
  } = useActionSWR(['paymentsOverview', paidFromDate, paidToDate], () =>
    getPaymentsOverview({
      paidFromDate: paidFromDate || undefined,
      paidToDate: paidToDate || undefined,
    })
  );

  const error = fetchError ? fetchError.message : null;

  const overdueIds = useMemo(
    () => new Set((data?.toPay ?? []).filter((r) => isOverdue(r.dueDate)).map((r) => r.id)),
    [data]
  );

  const setStatus = async (id: number, value: PaymentStatus) => {
    setPendingId(id);
    await setReceivedInvoicePaymentStatus(id, value);
    setPendingId(null);
    refetch();
  };

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-lg font-medium lg:text-2xl">
          <CreditCard className="h-5 w-5" />
          Payments
        </h1>
        <p className="text-sm text-gray-500">
          What your company owes and what it has paid. Only confirmed received
          invoices count here — drafts are still in{' '}
          <Link
            href={`/c/${companyId}/received-invoices`}
            className="text-primary/90 hover:underline"
          >
            received invoices
          </Link>
          .
        </p>
      </div>

      <ErrorAlert message={error} className="mb-4" />

      <PaymentKpiGrid totals={data?.totals} loading={loading} />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-rose-600" />
            To pay
            {data && (
              <span className="text-xs font-normal text-gray-500">
                ({data.toPay.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <PaymentLoadingRow />
          ) : !data?.toPay.length ? (
            <PaymentEmptyRow text="Nothing to pay. You're all caught up." accent="green" />
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
            Paid
            {data && (
              <span className="text-xs font-normal text-gray-500">
                ({data.paid.length})
              </span>
            )}
          </CardTitle>
          <PaymentDateFilters
            fromDate={paidFromDate}
            onFromDateChange={setPaidFromDate}
            toDate={paidToDate}
            onToDateChange={setPaidToDate}
            onClear={() => {
              setPaidFromDate('');
              setPaidToDate('');
            }}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <PaymentLoadingRow />
          ) : !data?.paid.length ? (
            <PaymentEmptyRow text="No paid invoices in this date range." accent="gray" />
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
    </section>
  );
}

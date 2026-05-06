'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getPaymentsOverview,
  setReceivedInvoicePaymentStatus,
  type PaymentRow,
  type PaymentsOverview,
} from '@/src/features/received-invoices/actions';
import type { PaymentStatus } from '@/src/features/received-invoices/types';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB');
}

function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

// Default: paid invoices issued in the last 90 days.
function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

export default function PaymentsPage() {
  const params = useParams();
  const companyId = params.companyId as string;

  const [data, setData] = useState<PaymentsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paidFromDate, setPaidFromDate] = useState(ninetyDaysAgo());
  const [paidToDate, setPaidToDate] = useState('');
  const [pendingId, setPendingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getPaymentsOverview({
      paidFromDate: paidFromDate || undefined,
      paidToDate: paidToDate || undefined,
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) setData(res.data);
  }, [paidFromDate, paidToDate]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const setStatus = async (id: number, value: PaymentStatus) => {
    setPendingId(id);
    await setReceivedInvoicePaymentStatus(id, value);
    setPendingId(null);
    fetchData();
  };

  const overdueRows = useMemo(
    () => (data?.toPay ?? []).filter((r) => isOverdue(r.dueDate)),
    [data]
  );

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
            className="text-orange-600 hover:underline"
          >
            received invoices
          </Link>
          .
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          icon={<Clock className="h-5 w-5 text-rose-600" />}
          label="To pay"
          value={`${formatMoney(data?.totals.toPayAmount ?? 0)} EUR`}
          color="rose"
          loading={loading}
        />
        <KpiCard
          icon={<TrendingDown className="h-5 w-5 text-purple-600" />}
          label="Paid this month"
          value={`${formatMoney(data?.totals.paidThisMonthAmount ?? 0)} EUR`}
          color="purple"
          loading={loading}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Overdue"
          value={
            (data?.totals.overdueCount ?? 0) > 0
              ? `${data?.totals.overdueCount} · ${formatMoney(data?.totals.overdueAmount ?? 0)} EUR`
              : '0'
          }
          color={
            (data?.totals.overdueCount ?? 0) > 0 ? 'red' : 'gray'
          }
          loading={loading}
          highlight={(data?.totals.overdueCount ?? 0) > 0}
        />
      </div>

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
            <LoadingRow />
          ) : !data?.toPay.length ? (
            <EmptyRow
              text="Nothing to pay. You're all caught up."
              accent="green"
            />
          ) : (
            <PaymentTable
              rows={data.toPay}
              companyId={companyId}
              kind="toPay"
              pendingId={pendingId}
              onMark={setStatus}
              overdueIds={new Set(overdueRows.map((r) => r.id))}
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
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="paidFrom" className="text-xs">
                From
              </Label>
              <Input
                id="paidFrom"
                type="date"
                className="mt-1 h-8"
                value={paidFromDate}
                onChange={(e) => setPaidFromDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="paidTo" className="text-xs">
                To
              </Label>
              <Input
                id="paidTo"
                type="date"
                className="mt-1 h-8"
                value={paidToDate}
                onChange={(e) => setPaidToDate(e.target.value)}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPaidFromDate('');
                setPaidToDate('');
              }}
            >
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <LoadingRow />
          ) : !data?.paid.length ? (
            <EmptyRow text="No paid invoices in this date range." accent="gray" />
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

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
  loading?: boolean;
}

function KpiCard({ icon, label, value, color, highlight, loading }: KpiCardProps) {
  const bgMap: Record<string, string> = {
    rose: 'bg-rose-50',
    purple: 'bg-purple-50',
    red: 'bg-red-50',
    gray: 'bg-gray-50',
  };
  return (
    <Card className={highlight ? 'border-red-300 bg-red-50/30' : ''}>
      <CardContent className="pt-5">
        <div className="mb-2 flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${bgMap[color] ?? 'bg-gray-50'}`}
          >
            {icon}
          </div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  );
}

function EmptyRow({ text, accent }: { text: string; accent: 'green' | 'gray' }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-gray-500">
      {accent === 'green' ? (
        <CheckCircle2 className="h-7 w-7 text-green-300" />
      ) : (
        <FileText className="h-7 w-7 text-gray-300" />
      )}
      <p>{text}</p>
    </div>
  );
}

function PaymentTable({
  rows,
  companyId,
  kind,
  pendingId,
  onMark,
  overdueIds,
}: {
  rows: PaymentRow[];
  companyId: string;
  kind: 'toPay' | 'paid';
  pendingId: number | null;
  onMark: (id: number, status: PaymentStatus) => void;
  overdueIds: Set<number>;
}) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50/80">
          <th className="w-8 px-2 py-3" />
          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
            Supplier
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
            Number
          </th>
          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
            Issue date
          </th>
          {kind === 'toPay' && (
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
              Due date
            </th>
          )}
          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-600">
            Amount
          </th>
          {kind === 'toPay' && (
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
              Status
            </th>
          )}
          <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-600">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const overdue = overdueIds.has(row.id);
          return (
            <tr
              key={row.id}
              className={`border-b border-gray-200 ${overdue ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-gray-50/50'}`}
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
              {kind === 'toPay' && (
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
              {kind === 'toPay' && (
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
                  {kind === 'toPay' ? (
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

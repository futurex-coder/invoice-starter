import {
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Inbox,
  TrendingDown,
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { formatMoney } from '@/lib/format';
import type { CompanyExpenseMetrics, CompanyMetrics } from './queries';

interface Props {
  metrics: CompanyMetrics;
  expenseMetrics: CompanyExpenseMetrics;
  currency: string;
  companyId: string;
}

export function MetricsSummary({
  metrics,
  expenseMetrics,
  currency,
  companyId,
}: Props) {
  // UX: every card is a shortcut into its filtered list (fewer clicks).
  const base = `/c/${companyId}`;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          label="Приходи"
          value={`${formatMoney(metrics.revenue)} ${currency}`}
          color="green"
          href={`${base}/invoices?paymentStatus=paid`}
        />
        <MetricCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Вземания"
          value={`${formatMoney(metrics.outstanding)} ${currency}`}
          color="amber"
          href={`${base}/invoices?paymentStatus=unpaid`}
        />
        <MetricCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          label="Фактури този месец"
          value={String(metrics.invoiceCountThisMonth)}
          color="blue"
          href={`${base}/invoices`}
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Просрочени"
          value={String(metrics.overdueCount)}
          color={metrics.overdueCount > 0 ? 'red' : 'gray'}
          highlight={metrics.overdueCount > 0}
          href={`${base}/invoices?paymentStatus=unpaid`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<TrendingDown className="h-5 w-5 text-purple-600" />}
          label="Платени разходи"
          value={`${formatMoney(expenseMetrics.expensesPaid)} ${currency}`}
          color="purple"
          href={`${base}/received-invoices?paymentStatus=paid`}
        />
        <MetricCard
          icon={<TrendingDown className="h-5 w-5 text-rose-600" />}
          label="Задължения"
          value={`${formatMoney(expenseMetrics.expensesOutstanding)} ${currency}`}
          color="rose"
          href={`${base}/received-invoices?paymentStatus=unpaid`}
        />
        <MetricCard
          icon={<Inbox className="h-5 w-5 text-blue-600" />}
          label="Получени този месец"
          value={String(expenseMetrics.receivedThisMonth)}
          color="blue"
          href={`${base}/received-invoices`}
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          label="За преглед"
          value={String(expenseMetrics.pendingReviewCount)}
          color={expenseMetrics.pendingReviewCount > 0 ? 'amber' : 'gray'}
          highlight={expenseMetrics.pendingReviewCount > 0}
          href={`${base}/received-invoices?status=draft`}
        />
      </div>
    </>
  );
}

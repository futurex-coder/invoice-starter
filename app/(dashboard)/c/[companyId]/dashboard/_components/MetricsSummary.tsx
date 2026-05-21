import {
  AlertTriangle,
  Clock,
  DollarSign,
  FileText,
  Inbox,
  TrendingDown,
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { formatCurrency } from './utils';
import type { CompanyExpenseMetrics, CompanyMetrics } from './queries';

interface Props {
  metrics: CompanyMetrics;
  expenseMetrics: CompanyExpenseMetrics;
  currency: string;
}

export function MetricsSummary({ metrics, expenseMetrics, currency }: Props) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <MetricCard
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          label="Revenue"
          value={`${formatCurrency(metrics.revenue)} ${currency}`}
          color="green"
        />
        <MetricCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Outstanding"
          value={`${formatCurrency(metrics.outstanding)} ${currency}`}
          color="amber"
        />
        <MetricCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          label="Invoices This Month"
          value={String(metrics.invoiceCountThisMonth)}
          color="blue"
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Overdue"
          value={String(metrics.overdueCount)}
          color={metrics.overdueCount > 0 ? 'red' : 'gray'}
          highlight={metrics.overdueCount > 0}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<TrendingDown className="h-5 w-5 text-purple-600" />}
          label="Expenses Paid"
          value={`${formatCurrency(expenseMetrics.expensesPaid)} ${currency}`}
          color="purple"
        />
        <MetricCard
          icon={<TrendingDown className="h-5 w-5 text-rose-600" />}
          label="Expenses Outstanding"
          value={`${formatCurrency(expenseMetrics.expensesOutstanding)} ${currency}`}
          color="rose"
        />
        <MetricCard
          icon={<Inbox className="h-5 w-5 text-blue-600" />}
          label="Received This Month"
          value={String(expenseMetrics.receivedThisMonth)}
          color="blue"
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          label="Pending Review"
          value={String(expenseMetrics.pendingReviewCount)}
          color={expenseMetrics.pendingReviewCount > 0 ? 'amber' : 'gray'}
          highlight={expenseMetrics.pendingReviewCount > 0}
        />
      </div>
    </>
  );
}

import { DollarSign, Clock, FileText, AlertTriangle, TrendingDown } from 'lucide-react';
import { SummaryCard } from './SummaryCard';
import { formatCurrency } from './utils';
import type { Totals } from './types';

interface Props {
  totals: Totals;
}

export function SummaryGrid({ totals }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
      <SummaryCard
        icon={<DollarSign className="h-5 w-5 text-green-600" />}
        label="Revenue"
        value={`${formatCurrency(totals.revenue)} EUR`}
        color="green"
      />
      <SummaryCard
        icon={<Clock className="h-5 w-5 text-amber-600" />}
        label="Outstanding"
        value={`${formatCurrency(totals.outstanding)} EUR`}
        color="amber"
      />
      <SummaryCard
        icon={<TrendingDown className="h-5 w-5 text-purple-600" />}
        label="Expenses Paid"
        value={`${formatCurrency(totals.expensesPaid)} EUR`}
        color="purple"
      />
      <SummaryCard
        icon={<TrendingDown className="h-5 w-5 text-rose-600" />}
        label="Expenses Outstanding"
        value={`${formatCurrency(totals.expensesOutstanding)} EUR`}
        color="rose"
      />
      <SummaryCard
        icon={<FileText className="h-5 w-5 text-blue-600" />}
        label="Invoices This Month"
        value={String(totals.invoiceCount)}
        color="blue"
      />
      <SummaryCard
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        label="Overdue"
        value={String(totals.overdueCount)}
        color={totals.overdueCount > 0 ? 'red' : 'gray'}
        highlight={totals.overdueCount > 0}
      />
    </div>
  );
}

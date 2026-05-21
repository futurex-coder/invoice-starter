import { DollarSign, Clock, FileText, AlertTriangle } from 'lucide-react';
import { SummaryCard } from './SummaryCard';
import { formatCurrency } from './utils';
import type { Totals } from './types';

interface Props {
  totals: Totals;
  hasMultipleCurrencies: boolean;
}

export function SummaryGrid({ totals, hasMultipleCurrencies }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <SummaryCard
        icon={<DollarSign className="h-5 w-5 text-green-600" />}
        label="Total Revenue"
        value={formatCurrency(totals.revenue)}
        sub={hasMultipleCurrencies ? 'mixed currencies' : undefined}
        color="green"
      />
      <SummaryCard
        icon={<Clock className="h-5 w-5 text-amber-600" />}
        label="Outstanding"
        value={formatCurrency(totals.outstanding)}
        sub={hasMultipleCurrencies ? 'mixed currencies' : undefined}
        color="amber"
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

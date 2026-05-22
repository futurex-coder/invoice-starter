import { AlertTriangle, Clock, TrendingDown } from 'lucide-react';
import type { PaymentsOverview } from '@/src/features/received-invoices/actions';
import { KpiCard } from './KpiCard';
import { formatMoney } from './utils';

interface Props {
  totals: PaymentsOverview['totals'] | undefined;
  loading: boolean;
}

export function PaymentKpiGrid({ totals, loading }: Props) {
  const overdueCount = totals?.overdueCount ?? 0;
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        icon={<Clock className="h-5 w-5 text-rose-600" />}
        label="To pay"
        value={`${formatMoney(totals?.toPayAmount ?? 0)} EUR`}
        color="rose"
        loading={loading}
      />
      <KpiCard
        icon={<TrendingDown className="h-5 w-5 text-purple-600" />}
        label="Paid this month"
        value={`${formatMoney(totals?.paidThisMonthAmount ?? 0)} EUR`}
        color="purple"
        loading={loading}
      />
      <KpiCard
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        label="Overdue"
        value={
          overdueCount > 0
            ? `${overdueCount} · ${formatMoney(totals?.overdueAmount ?? 0)} EUR`
            : '0'
        }
        color={overdueCount > 0 ? 'red' : 'gray'}
        highlight={overdueCount > 0}
        loading={loading}
      />
    </div>
  );
}

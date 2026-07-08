import { AlertTriangle, Clock, TrendingDown } from 'lucide-react';
import type { PaymentsOverview } from '@/src/features/received-invoices/actions';
import { KpiCard } from './KpiCard';
import { formatMoney } from '@/lib/format';

interface Props {
  totals: PaymentsOverview['totals'] | undefined;
  loading: boolean;
  /** Company base currency (GEN-1): all amounts are converted to it. */
  baseCurrency: string;
}

export function PaymentKpiGrid({ totals, loading, baseCurrency }: Props) {
  const overdueCount = totals?.overdueCount ?? 0;
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        icon={<Clock className="h-5 w-5 text-rose-600" />}
        label="За плащане"
        value={`${formatMoney(totals?.toPayAmount ?? 0)} ${baseCurrency}`}
        color="rose"
        loading={loading}
      />
      <KpiCard
        icon={<TrendingDown className="h-5 w-5 text-purple-600" />}
        label="Платени този месец"
        value={`${formatMoney(totals?.paidThisMonthAmount ?? 0)} ${baseCurrency}`}
        color="purple"
        loading={loading}
      />
      <KpiCard
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        label="Просрочени"
        value={
          overdueCount > 0
            ? `${overdueCount} · ${formatMoney(totals?.overdueAmount ?? 0)} ${baseCurrency}`
            : '0'
        }
        color={overdueCount > 0 ? 'red' : 'gray'}
        highlight={overdueCount > 0}
        loading={loading}
      />
    </div>
  );
}

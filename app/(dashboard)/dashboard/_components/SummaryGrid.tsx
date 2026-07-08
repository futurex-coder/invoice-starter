import { DollarSign, Clock, FileText, AlertTriangle, TrendingDown } from 'lucide-react';
import { SummaryCard } from './SummaryCard';
import { formatMoney } from '@/lib/format';
import type { Totals } from './types';

interface Props {
  totals: Totals;
  /**
   * The single base currency shared by all of the user's companies, or `null`
   * when they use different currencies. Cross-company totals sum raw amounts
   * (see getDashboardMetrics), so a currency suffix is only honest when every
   * company shares one — otherwise we drop it and flag the mix below.
   */
  currency: string | null;
}

export function SummaryGrid({ totals, currency }: Props) {
  const money = (n: number) =>
    currency ? `${formatMoney(n)} ${currency}` : formatMoney(n);

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          label="Приходи"
          value={money(totals.revenue)}
          color="green"
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Вземания"
          value={money(totals.outstanding)}
          color="amber"
        />
        <SummaryCard
          icon={<TrendingDown className="h-5 w-5 text-purple-600" />}
          label="Платени разходи"
          value={money(totals.expensesPaid)}
          color="purple"
        />
        <SummaryCard
          icon={<TrendingDown className="h-5 w-5 text-rose-600" />}
          label="Задължения"
          value={money(totals.expensesOutstanding)}
          color="rose"
        />
        <SummaryCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          label="Фактури този месец"
          value={String(totals.invoiceCount)}
          color="blue"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Просрочени"
          value={String(totals.overdueCount)}
          color={totals.overdueCount > 0 ? 'red' : 'gray'}
          highlight={totals.overdueCount > 0}
        />
      </div>
      {currency === null && (
        <p className="mt-2 text-xs text-gray-500">
          Фирмите ви използват различни валути — сумите тук са в смесени валути.
          Вижте всяка фирма поотделно за точни стойности.
        </p>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import type { PaymentsSummary } from '@/src/features/received-invoices/actions';

type Color = 'rose' | 'purple' | 'red' | 'gray';

const BG_MAP: Record<Color, string> = {
  rose: 'bg-rose-50',
  purple: 'bg-purple-50',
  red: 'bg-red-50',
  gray: 'bg-gray-50',
};

function KpiCard({
  icon,
  label,
  value,
  color,
  highlight,
  loading,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: Color;
  highlight?: boolean;
  loading?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-red-300 bg-red-50/30' : ''}>
      <CardContent className="pt-5">
        <div className="mb-2 flex items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg',
              BG_MAP[color]
            )}
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

interface Props {
  summary: PaymentsSummary | undefined;
  loading: boolean;
  /** Company base currency (GEN-1) — every figure is converted to it. */
  baseCurrency: string;
}

/**
 * Money KPIs for received (supplier) invoices — what the company owes, what it
 * paid this month, and what's overdue. Lives on the received-invoices page so
 * "what do I owe" and the document list are one screen (the standalone Payments
 * page was a redundant view over the same data).
 */
export function PaymentSummaryCards({ summary, loading, baseCurrency }: Props) {
  const overdueCount = summary?.overdueCount ?? 0;
  return (
    <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        icon={<Clock className="h-5 w-5 text-rose-600" />}
        label="За плащане"
        value={`${formatMoney(summary?.toPayAmount ?? 0)} ${baseCurrency}`}
        color="rose"
        loading={loading}
      />
      <KpiCard
        icon={<CheckCircle2 className="h-5 w-5 text-purple-600" />}
        label="Платени този месец"
        value={`${formatMoney(summary?.paidThisMonthAmount ?? 0)} ${baseCurrency}`}
        color="purple"
        loading={loading}
      />
      <KpiCard
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        label="Просрочени"
        value={
          overdueCount > 0
            ? `${overdueCount} · ${formatMoney(summary?.overdueAmount ?? 0)} ${baseCurrency}`
            : '0'
        }
        color={overdueCount > 0 ? 'red' : 'gray'}
        highlight={overdueCount > 0}
        loading={loading}
      />
    </div>
  );
}

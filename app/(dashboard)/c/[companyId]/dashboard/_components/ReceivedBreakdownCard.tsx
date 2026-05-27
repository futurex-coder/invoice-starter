import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BreakdownRow } from './BreakdownRow';
import type { CompanyExpenseMetrics } from './queries';

interface Props {
  expenseMetrics: CompanyExpenseMetrics;
  viewAllHref: string;
}

export function ReceivedBreakdownCard({ expenseMetrics, viewAllHref }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Received Invoices</CardTitle>
        <Link href={viewAllHref} className="text-xs text-primary/90 hover:underline">
          View all →
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <BreakdownRow label="Pending review" value={expenseMetrics.pendingReviewCount} />
          <BreakdownRow
            label="Confirmed — accounted"
            value={expenseMetrics.accountedCount}
          />
          <BreakdownRow
            label="Confirmed — to account"
            value={expenseMetrics.pendingAccountingCount}
          />
          <div className="border-t pt-2 mt-2">
            <BreakdownRow label="This month" value={expenseMetrics.receivedThisMonth} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BreakdownRow } from './BreakdownRow';
import type { CompanyMetrics } from './queries';

interface Props {
  metrics: CompanyMetrics;
  partnerCount: number;
  articleCount: number;
}

export function InvoiceBreakdownCard({ metrics, partnerCount, articleCount }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Разбивка на фактурите</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <BreakdownRow label="Общо фактури" value={metrics.totalInvoices} />
          <BreakdownRow label="Чернови" value={metrics.draftCount} />
          <BreakdownRow label="Издадени" value={metrics.finalizedCount} />
          <BreakdownRow label="Кредитни известия" value={metrics.creditNotes} />
          <BreakdownRow label="Дебитни известия" value={metrics.debitNotes} />
          <div className="border-t pt-2 mt-2">
            <BreakdownRow label="Контрагенти" value={partnerCount} />
            <BreakdownRow label="Артикули" value={articleCount} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

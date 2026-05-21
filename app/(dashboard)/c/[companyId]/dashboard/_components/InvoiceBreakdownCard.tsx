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
        <CardTitle>Invoice Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <BreakdownRow label="Total invoices" value={metrics.totalInvoices} />
          <BreakdownRow label="Drafts" value={metrics.draftCount} />
          <BreakdownRow label="Finalized" value={metrics.finalizedCount} />
          <BreakdownRow label="Credit notes" value={metrics.creditNotes} />
          <BreakdownRow label="Debit notes" value={metrics.debitNotes} />
          <div className="border-t pt-2 mt-2">
            <BreakdownRow label="Partners" value={partnerCount} />
            <BreakdownRow label="Articles" value={articleCount} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReceivedInvoice } from '@/lib/db/schema';
import { formatDate } from '@/lib/format';

interface Props {
  row: ReceivedInvoice;
}

export function DocumentCard({ row }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Документ</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Номер на фактура</span>
          <p>{row.invoiceNumber ?? '—'}</p>
        </div>
        <div>
          <span className="text-gray-500">Валута</span>
          <p>{row.currency}</p>
        </div>
        <div>
          <span className="text-gray-500">Дата на издаване</span>
          <p>{formatDate(row.issueDate)}</p>
        </div>
        <div>
          <span className="text-gray-500">Падеж</span>
          <p>{formatDate(row.dueDate)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

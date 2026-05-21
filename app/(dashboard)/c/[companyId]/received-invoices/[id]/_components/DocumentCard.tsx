import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReceivedInvoice } from '@/lib/db/schema';
import { formatDate } from './utils';

interface Props {
  row: ReceivedInvoice;
}

export function DocumentCard({ row }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Document</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-500">Invoice number</span>
          <p>{row.invoiceNumber ?? '—'}</p>
        </div>
        <div>
          <span className="text-gray-500">Currency</span>
          <p>{row.currency}</p>
        </div>
        <div>
          <span className="text-gray-500">Issue date</span>
          <p>{formatDate(row.issueDate)}</p>
        </div>
        <div>
          <span className="text-gray-500">Due date</span>
          <p>{formatDate(row.dueDate)}</p>
        </div>
      </CardContent>
    </Card>
  );
}

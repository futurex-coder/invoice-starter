import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReceivedInvoice, ReceivedInvoiceLine } from '@/lib/db/schema';

interface Props {
  row: ReceivedInvoice;
  lines: ReceivedInvoiceLine[];
}

const HEADER_CELL = 'px-4 py-2 text-right text-xs font-medium uppercase text-gray-600';

export function LineItemsTable({ row, lines }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Артикули</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50/80">
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-600">
                Описание
              </th>
              <th className={HEADER_CELL}>Количество</th>
              <th className={HEADER_CELL}>Ед. цена</th>
              <th className={HEADER_CELL}>ДДС</th>
              <th className={HEADER_CELL}>Стойност</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="px-4 py-2">{l.description}</td>
                <td className="px-4 py-2 text-right">
                  {Number(l.quantity)} {l.unit}
                </td>
                <td className="px-4 py-2 text-right">
                  {Number(l.unitPrice).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">{l.vatRate}%</td>
                <td className="px-4 py-2 text-right font-medium">
                  {Number(l.grossAmount).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50/50 text-sm">
              <td className="px-4 py-2" colSpan={3} />
              <td className="px-4 py-2 text-right text-gray-600">Данъчна основа</td>
              <td className="px-4 py-2 text-right">
                {Number(row.netAmount).toFixed(2)} {row.currency}
              </td>
            </tr>
            <tr className="bg-gray-50/50 text-sm">
              <td className="px-4 py-2" colSpan={3} />
              <td className="px-4 py-2 text-right text-gray-600">ДДС</td>
              <td className="px-4 py-2 text-right">
                {Number(row.vatAmount).toFixed(2)} {row.currency}
              </td>
            </tr>
            <tr className="bg-gray-50 font-medium">
              <td className="px-4 py-2" colSpan={3} />
              <td className="px-4 py-2 text-right">Общо</td>
              <td className="px-4 py-2 text-right">
                {Number(row.grossAmount).toFixed(2)} {row.currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SupplierSnapshot } from '@/src/features/received-invoices/types';

interface Props {
  supplier: SupplierSnapshot;
}

export function SupplierCard({ supplier }: Props) {
  const addressParts = [supplier.street, supplier.city, supplier.country].filter(Boolean);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Доставчик</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-medium">{supplier.legalName ?? '—'}</p>
        {supplier.eik && <p>ЕИК: {supplier.eik}</p>}
        {supplier.vatNumber && <p>ДДС номер: {supplier.vatNumber}</p>}
        {addressParts.length > 0 && (
          <p className="text-gray-600">{addressParts.join(', ')}</p>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  AccountingStatus,
  PaymentStatus,
} from '@/src/features/received-invoices/types';
import {
  isAccountingStatus,
  isPaymentStatus,
} from '@/src/features/received-invoices/parsers';

interface Props {
  accountingStatus: string;
  paymentStatus: string;
  onAccountingChange: (value: AccountingStatus) => void;
  onPaymentChange: (value: PaymentStatus) => void;
}

export function StatusControlsCard({
  accountingStatus,
  paymentStatus,
  onAccountingChange,
  onPaymentChange,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Status</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Accounting</label>
          <select
            className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={accountingStatus}
            onChange={(e) => {
              if (isAccountingStatus(e.target.value)) onAccountingChange(e.target.value);
            }}
          >
            <option value="pending">Pending</option>
            <option value="accounted">Accounted</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Payment</label>
          <select
            className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={paymentStatus}
            onChange={(e) => {
              if (isPaymentStatus(e.target.value)) onPaymentChange(e.target.value);
            }}
          >
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </CardContent>
    </Card>
  );
}

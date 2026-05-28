'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
          <Select
            value={accountingStatus}
            onValueChange={(v) => {
              if (isAccountingStatus(v)) onAccountingChange(v);
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accounted">Accounted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-gray-500">Payment</label>
          <Select
            value={paymentStatus}
            onValueChange={(v) => {
              if (isPaymentStatus(v)) onPaymentChange(v);
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Company } from '@/lib/db/schema';
import { isPaymentMethod } from '@/src/features/bulgarian-invoicing/parsers';
import { PAYMENT_METHODS, type PaymentMethod } from './types';

interface Props {
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  companyProfile: Company | null;
  dueDate: string;
  onDueDateChange: (value: string) => void;
  paymentStatus: string;
  onPaymentStatusChange: (value: string) => void;
}

export function PaymentCard({
  paymentMethod,
  onPaymentMethodChange,
  companyProfile,
  dueDate,
  onDueDateChange,
  paymentStatus,
  onPaymentStatusChange,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Method</Label>
          <RadioGroup
            value={paymentMethod}
            onValueChange={(v) => {
              if (isPaymentMethod(v)) onPaymentMethodChange(v);
            }}
            className="flex gap-4 pt-2"
          >
            {PAYMENT_METHODS.map((m) => (
              <div key={m} className="flex items-center space-x-2">
                <RadioGroupItem value={m} id={`pay-${m}`} />
                <Label htmlFor={`pay-${m}`}>{m}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        {paymentMethod === 'bank' && companyProfile?.iban && (
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <p className="font-medium">Bank details (from company profile)</p>
            <p>{companyProfile.bankName}</p>
            <p>IBAN: {companyProfile.iban}</p>
            {companyProfile.bicSwift && <p>BIC/SWIFT: {companyProfile.bicSwift}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dueDate">Due date (optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
            />
          </div>
          <div>
            <Label>Payment status</Label>
            <select
              className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={paymentStatus}
              onChange={(e) => onPaymentStatusChange(e.target.value)}
            >
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

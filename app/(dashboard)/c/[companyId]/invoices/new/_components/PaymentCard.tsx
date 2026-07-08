'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Company } from '@/lib/db/schema';
import { isPaymentMethod } from '@/src/features/bulgarian-invoicing/parsers';
import { PAYMENT_METHODS, type PaymentMethod } from './types';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank: 'Банков път',
  cash: 'В брой',
  barter: 'Бартер',
};

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
        <CardTitle>Плащане</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Начин на плащане</Label>
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
                <Label htmlFor={`pay-${m}`}>{PAYMENT_METHOD_LABELS[m]}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        {paymentMethod === 'bank' && companyProfile?.iban && (
          <div className="rounded-md bg-gray-50 p-3 text-sm">
            <p className="font-medium">Банкови данни (от профила на фирмата)</p>
            <p>{companyProfile.bankName}</p>
            <p>IBAN: {companyProfile.iban}</p>
            {companyProfile.bicSwift && <p>BIC/SWIFT: {companyProfile.bicSwift}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="dueDate">Падеж (по желание)</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
            />
          </div>
          <div>
            <Label>Статус на плащане</Label>
            <Select value={paymentStatus} onValueChange={onPaymentStatusChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Неплатена</SelectItem>
                <SelectItem value="partial">Частично</SelectItem>
                <SelectItem value="paid">Платена</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

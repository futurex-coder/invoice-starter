'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  CURRENCIES,
  PAYMENT_METHODS,
  isPaymentMethod,
  type PaymentMethod,
} from './types';

interface Props {
  defaultCurrency: string;
  onDefaultCurrencyChange: (value: string) => void;
  defaultVatRate: number;
  onDefaultVatRateChange: (value: number) => void;
  defaultPaymentMethod: PaymentMethod;
  onDefaultPaymentMethodChange: (value: PaymentMethod) => void;
}

export function InvoiceDefaultsCard({
  defaultCurrency,
  onDefaultCurrencyChange,
  defaultVatRate,
  onDefaultVatRateChange,
  defaultPaymentMethod,
  onDefaultPaymentMethodChange,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Invoice defaults</CardTitle>
        <CardDescription>Pre-filled values for new invoices</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Default currency</Label>
            <select
              className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={defaultCurrency}
              onChange={(e) => onDefaultCurrencyChange(e.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="defaultVatRate">Default VAT rate (%)</Label>
            <Input
              id="defaultVatRate"
              type="number"
              min={0}
              max={100}
              value={defaultVatRate}
              onChange={(e) => onDefaultVatRateChange(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label>Default payment method</Label>
            <select
              className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={defaultPaymentMethod}
              onChange={(e) => {
                const v = e.target.value;
                if (isPaymentMethod(v)) onDefaultPaymentMethodChange(v);
              }}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

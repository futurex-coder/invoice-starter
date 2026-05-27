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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
            <Select
              value={defaultCurrency}
              onValueChange={onDefaultCurrencyChange}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Select
              value={defaultPaymentMethod}
              onValueChange={(v) => {
                if (isPaymentMethod(v)) onDefaultPaymentMethodChange(v);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

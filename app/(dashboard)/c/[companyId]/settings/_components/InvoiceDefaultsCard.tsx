'use client';

import { Input } from '@/components/ui/input';
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
import { FormField } from '@/components/forms/form-field';
import {
  CURRENCIES,
  PAYMENT_METHODS,
  isPaymentMethod,
  type PaymentMethod,
} from './types';
import type { ValidationIssue } from '@/lib/actions/result';

interface Props {
  defaultCurrency: string;
  onDefaultCurrencyChange: (value: string) => void;
  defaultVatRate: number;
  onDefaultVatRateChange: (value: number) => void;
  defaultPaymentMethod: PaymentMethod;
  onDefaultPaymentMethodChange: (value: PaymentMethod) => void;
  validationErrors?: ValidationIssue[] | null;
}

export function InvoiceDefaultsCard({
  defaultCurrency,
  onDefaultCurrencyChange,
  defaultVatRate,
  onDefaultVatRateChange,
  defaultPaymentMethod,
  onDefaultPaymentMethodChange,
  validationErrors,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Invoice defaults</CardTitle>
        <CardDescription>Pre-filled values for new invoices</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            name="defaultCurrency"
            label="Default currency"
            errors={validationErrors}
          >
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
          </FormField>
          <FormField
            name="defaultVatRate"
            label="Default VAT rate (%)"
            errors={validationErrors}
          >
            <Input
              type="number"
              min={0}
              max={100}
              value={defaultVatRate}
              onChange={(e) => onDefaultVatRateChange(Number(e.target.value) || 0)}
            />
          </FormField>
          <FormField
            name="defaultPaymentMethod"
            label="Default payment method"
            errors={validationErrors}
          >
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
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
}

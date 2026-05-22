'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, ArrowRight } from 'lucide-react';
import {
  CURRENCIES,
  PAYMENT_METHODS,
  isPaymentMethod,
  type PaymentMethod,
} from './types';

interface Props {
  bankName: string;
  onBankNameChange: (value: string) => void;
  iban: string;
  onIbanChange: (value: string) => void;
  bicSwift: string;
  onBicSwiftChange: (value: string) => void;
  defaultPaymentMethod: PaymentMethod;
  onDefaultPaymentMethodChange: (value: PaymentMethod) => void;
  defaultCurrency: string;
  onDefaultCurrencyChange: (value: string) => void;
  defaultVatRate: number;
  onDefaultVatRateChange: (value: number) => void;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
}

export function BankStep({
  bankName,
  onBankNameChange,
  iban,
  onIbanChange,
  bicSwift,
  onBicSwiftChange,
  defaultPaymentMethod,
  onDefaultPaymentMethodChange,
  defaultCurrency,
  onDefaultCurrencyChange,
  defaultVatRate,
  onDefaultVatRateChange,
  saving,
  onSave,
  onSkip,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bank Details</CardTitle>
        <CardDescription>
          Optional — used when payment method is &quot;bank&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="ob-bankName">Bank name</Label>
          <Input
            id="ob-bankName"
            value={bankName}
            onChange={(e) => onBankNameChange(e.target.value)}
            placeholder="UniCredit Bulbank"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="ob-iban">IBAN</Label>
            <Input
              id="ob-iban"
              value={iban}
              onChange={(e) => onIbanChange(e.target.value)}
              placeholder="BG80BNBG96611020345678"
              maxLength={34}
            />
          </div>
          <div>
            <Label htmlFor="ob-bicSwift">BIC / SWIFT</Label>
            <Input
              id="ob-bicSwift"
              value={bicSwift}
              onChange={(e) => onBicSwiftChange(e.target.value)}
              placeholder="UNCRBGSF"
              maxLength={11}
            />
          </div>
        </div>

        <hr className="my-2" />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <Label htmlFor="ob-vatRate">Default VAT rate (%)</Label>
            <Input
              id="ob-vatRate"
              type="number"
              min={0}
              max={100}
              value={defaultVatRate}
              onChange={(e) => onDefaultVatRateChange(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Skip for now
          </button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Save &amp; Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

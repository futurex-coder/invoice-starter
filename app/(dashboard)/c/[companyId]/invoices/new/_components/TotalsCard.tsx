'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { amountInWordsBg } from '@/src/features/bulgarian-invoicing';
import type { InvoiceTotals } from '@/src/features/bulgarian-invoicing/types';

interface Props {
  totals: InvoiceTotals;
  currency: string;
  amountInWordsOverride: string;
  onAmountInWordsOverrideChange: (value: string) => void;
}

export function TotalsCard({
  totals,
  currency,
  amountInWordsOverride,
  onAmountInWordsOverrideChange,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Totals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Tax base (net)</span>
          <span>{totals.netAmount.toFixed(2)} {currency}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>VAT</span>
          <span>{totals.vatAmount.toFixed(2)} {currency}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Total payable</span>
          <span>{totals.grossAmount.toFixed(2)} {currency}</span>
        </div>
        <div>
          <Label>Словом (amount in words) *</Label>
          <p className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {amountInWordsBg(totals.grossAmount, currency)}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">
              Override manually
            </summary>
            <Input
              className="mt-1"
              value={amountInWordsOverride}
              onChange={(e) => onAmountInWordsOverrideChange(e.target.value)}
              placeholder="Leave empty to use auto-generated text"
            />
          </details>
        </div>
      </CardContent>
    </Card>
  );
}

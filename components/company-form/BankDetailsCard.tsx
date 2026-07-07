'use client';

import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FormField } from '@/components/forms/form-field';
import type { ValidationIssue } from '@/lib/actions/result';

interface Props {
  bankName: string;
  onBankNameChange: (value: string) => void;
  iban: string;
  onIbanChange: (value: string) => void;
  bicSwift: string;
  onBicSwiftChange: (value: string) => void;
  validationErrors?: ValidationIssue[] | null;
}

export function BankDetailsCard({
  bankName,
  onBankNameChange,
  iban,
  onIbanChange,
  bicSwift,
  onBicSwiftChange,
  validationErrors,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Bank details</CardTitle>
        <CardDescription>
          Optional — used when payment method is &quot;bank&quot;
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField name="bankName" label="Bank name" errors={validationErrors}>
          <Input
            value={bankName}
            onChange={(e) => onBankNameChange(e.target.value)}
            placeholder="UniCredit Bulbank"
          />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField name="iban" label="IBAN" errors={validationErrors}>
            <Input
              value={iban}
              onChange={(e) => onIbanChange(e.target.value)}
              placeholder="BG80BNBG96611020345678"
              maxLength={34}
            />
          </FormField>
          <FormField name="bicSwift" label="BIC / SWIFT" errors={validationErrors}>
            <Input
              value={bicSwift}
              onChange={(e) => onBicSwiftChange(e.target.value)}
              placeholder="UNCRBGSF"
              maxLength={11}
            />
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
}

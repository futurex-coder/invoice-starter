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

interface Props {
  bankName: string;
  onBankNameChange: (value: string) => void;
  iban: string;
  onIbanChange: (value: string) => void;
  bicSwift: string;
  onBicSwiftChange: (value: string) => void;
}

export function BankDetailsCard({
  bankName,
  onBankNameChange,
  iban,
  onIbanChange,
  bicSwift,
  onBicSwiftChange,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Bank details</CardTitle>
        <CardDescription>Optional — used when payment method is &quot;bank&quot;</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="bankName">Bank name</Label>
          <Input
            id="bankName"
            value={bankName}
            onChange={(e) => onBankNameChange(e.target.value)}
            placeholder="UniCredit Bulbank"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="iban">IBAN</Label>
            <Input
              id="iban"
              value={iban}
              onChange={(e) => onIbanChange(e.target.value)}
              placeholder="BG80BNBG96611020345678"
              maxLength={34}
            />
          </div>
          <div>
            <Label htmlFor="bicSwift">BIC / SWIFT</Label>
            <Input
              id="bicSwift"
              value={bicSwift}
              onChange={(e) => onBicSwiftChange(e.target.value)}
              placeholder="UNCRBGSF"
              maxLength={11}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

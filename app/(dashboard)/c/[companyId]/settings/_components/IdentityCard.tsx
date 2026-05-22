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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Props {
  legalName: string;
  onLegalNameChange: (value: string) => void;
  eik: string;
  onEikChange: (value: string) => void;
  eikLocked: boolean;
  isVatRegistered: boolean;
  onIsVatRegisteredChange: (value: boolean) => void;
  vatNumber: string;
  onVatNumberChange: (value: string) => void;
  mol: string;
  onMolChange: (value: string) => void;
}

export function IdentityCard({
  legalName,
  onLegalNameChange,
  eik,
  onEikChange,
  eikLocked,
  isVatRegistered,
  onIsVatRegisteredChange,
  vatNumber,
  onVatNumberChange,
  mol,
  onMolChange,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Company identity</CardTitle>
        <CardDescription>Legal name and registration numbers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="legalName">Legal name *</Label>
            <Input
              id="legalName"
              value={legalName}
              onChange={(e) => onLegalNameChange(e.target.value)}
              placeholder="ACME Ltd."
            />
          </div>
          <div>
            <Label htmlFor="eik">ЕИК (EIK / BULSTAT) *</Label>
            <Input
              id="eik"
              value={eik}
              onChange={(e) => onEikChange(e.target.value)}
              placeholder="123456789"
              maxLength={10}
              disabled={eikLocked}
              className={eikLocked ? 'bg-gray-50 text-gray-500' : ''}
            />
            {eikLocked && (
              <p className="mt-1 text-xs text-muted-foreground">
                EIK cannot be changed after company creation.
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>VAT registered?</Label>
            <RadioGroup
              value={isVatRegistered ? 'yes' : 'no'}
              onValueChange={(v) => onIsVatRegisteredChange(v === 'yes')}
              className="flex gap-4 pt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="vat-yes" />
                <Label htmlFor="vat-yes">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="vat-no" />
                <Label htmlFor="vat-no">No</Label>
              </div>
            </RadioGroup>
          </div>
          {isVatRegistered && (
            <div>
              <Label htmlFor="vatNumber">ДДС № (VAT number)</Label>
              <Input
                id="vatNumber"
                value={vatNumber}
                onChange={(e) => onVatNumberChange(e.target.value)}
                placeholder="BG123456789"
                maxLength={14}
              />
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="mol">МОЛ / Contact person</Label>
          <Input
            id="mol"
            value={mol}
            onChange={(e) => onMolChange(e.target.value)}
            placeholder="Иван Иванов"
          />
        </div>
      </CardContent>
    </Card>
  );
}

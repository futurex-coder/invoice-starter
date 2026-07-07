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
import { FormField } from '@/components/forms/form-field';
import type { ValidationIssue } from '@/lib/actions/result';

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
  validationErrors?: ValidationIssue[] | null;
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
  validationErrors,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Company identity</CardTitle>
        <CardDescription>Legal name and registration numbers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            name="legalName"
            label="Legal name"
            required
            errors={validationErrors}
          >
            <Input
              value={legalName}
              onChange={(e) => onLegalNameChange(e.target.value)}
              placeholder="ACME Ltd."
            />
          </FormField>
          <FormField
            name="eik"
            label="ЕИК (EIK / BULSTAT)"
            required
            errors={validationErrors}
            hint={
              eikLocked ? 'EIK cannot be changed after company creation.' : undefined
            }
          >
            <Input
              value={eik}
              onChange={(e) => onEikChange(e.target.value)}
              placeholder="123456789"
              maxLength={10}
              disabled={eikLocked}
              className={eikLocked ? 'bg-gray-50 text-gray-500' : ''}
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
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
            <FormField
              name="vatNumber"
              label="ДДС № (VAT number)"
              errors={validationErrors}
            >
              <Input
                value={vatNumber}
                onChange={(e) => onVatNumberChange(e.target.value)}
                placeholder="BG123456789"
                maxLength={14}
              />
            </FormField>
          )}
        </div>
        <FormField
          name="mol"
          label="МОЛ / Contact person"
          errors={validationErrors}
        >
          <Input
            value={mol}
            onChange={(e) => onMolChange(e.target.value)}
            placeholder="Иван Иванов"
          />
        </FormField>
      </CardContent>
    </Card>
  );
}

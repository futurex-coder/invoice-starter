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
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import type { EikStatus } from './form-state';

interface Props {
  legalName: string;
  onLegalNameChange: (value: string) => void;
  eik: string;
  onEikChange: (value: string) => void;
  onEikBlur: () => void;
  eikStatus: EikStatus;
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
  onEikBlur,
  eikStatus,
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
        <div>
          <Label htmlFor="legalName">Legal name *</Label>
          <Input
            id="legalName"
            value={legalName}
            onChange={(e) => onLegalNameChange(e.target.value)}
            placeholder="ACME Ltd."
            required
          />
        </div>

        <div>
          <Label htmlFor="eik">ЕИК (EIK / BULSTAT) *</Label>
          <div className="relative">
            <Input
              id="eik"
              value={eik}
              onChange={(e) => onEikChange(e.target.value)}
              onBlur={onEikBlur}
              placeholder="123456789"
              maxLength={13}
              required
              className={
                eikStatus === 'taken'
                  ? 'border-red-400 pr-9'
                  : eikStatus === 'available'
                    ? 'border-green-400 pr-9'
                    : ''
              }
            />
            {eikStatus === 'checking' && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-gray-400" />
            )}
            {eikStatus === 'available' && (
              <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-green-500" />
            )}
            {eikStatus === 'taken' && (
              <AlertCircle className="absolute right-2.5 top-2.5 h-4 w-4 text-red-500" />
            )}
          </div>
          {eikStatus === 'taken' && (
            <p className="mt-1.5 text-sm text-red-600">
              A company with this EIK already exists. Please ask the company owner to invite you instead.
            </p>
          )}
          {eikStatus === 'available' && (
            <p className="mt-1.5 text-sm text-green-600">EIK is available.</p>
          )}
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
          <Label htmlFor="mol">МОЛ / Representative</Label>
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

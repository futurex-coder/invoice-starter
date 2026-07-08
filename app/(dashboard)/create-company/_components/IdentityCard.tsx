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
import { FormField } from '@/components/forms/form-field';
import type { EikStatus } from './form-state';
import type { ValidationIssue } from '@/lib/actions/result';

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
  validationErrors?: ValidationIssue[] | null;
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
  validationErrors,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Идентификация на фирмата</CardTitle>
        <CardDescription>Наименование и регистрационни номера</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          name="legalName"
          label="Наименование"
          required
          errors={validationErrors}
        >
          <Input
            value={legalName}
            onChange={(e) => onLegalNameChange(e.target.value)}
            placeholder="ACME Ltd."
            required
          />
        </FormField>

        <div>
          <FormField
            name="eik"
            label="ЕИК / Булстат"
            required
            errors={validationErrors}
          >
            <div className="relative">
              <Input
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
          </FormField>
          {eikStatus === 'taken' && (
            <p className="mt-1.5 text-sm text-red-600">
              Фирма с този ЕИК вече съществува. Помолете собственика на фирмата да ви покани.
            </p>
          )}
          {eikStatus === 'available' && (
            <p className="mt-1.5 text-sm text-green-600">ЕИК е свободен.</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Регистрация по ДДС?</Label>
            <RadioGroup
              value={isVatRegistered ? 'yes' : 'no'}
              onValueChange={(v) => onIsVatRegisteredChange(v === 'yes')}
              className="flex gap-4 pt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="vat-yes" />
                <Label htmlFor="vat-yes">Да</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="vat-no" />
                <Label htmlFor="vat-no">Не</Label>
              </div>
            </RadioGroup>
          </div>
          {isVatRegistered && (
            <FormField
              name="vatNumber"
              label="ДДС номер"
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
          label="МОЛ / Представител"
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

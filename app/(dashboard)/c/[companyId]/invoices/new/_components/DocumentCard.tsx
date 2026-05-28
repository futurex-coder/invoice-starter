'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DOC_TYPES } from '@/src/features/bulgarian-invoicing/types';
import { formatDocTypeLabel } from '@/src/features/bulgarian-invoicing/formatter';
import { LANGUAGES, CURRENCIES } from './types';
import { Alert } from '@/components/ui/alert';

interface Props {
  docType: string;
  onDocTypeChange: (value: string) => void;
  isEditing: boolean;
  nextInvoiceNumber: number | null;
  issueDate: string;
  onIssueDateChange: (value: string) => void;
  supplyDate: string;
  onSupplyDateChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
  fxRate: number;
  onFxRateChange: (value: number) => void;
}

export function DocumentCard({
  docType,
  onDocTypeChange,
  isEditing,
  nextInvoiceNumber,
  issueDate,
  onIssueDateChange,
  supplyDate,
  onSupplyDateChange,
  language,
  onLanguageChange,
  currency,
  onCurrencyChange,
  fxRate,
  onFxRateChange,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Document</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Document type</Label>
          <RadioGroup
            value={docType}
            onValueChange={onDocTypeChange}
            className="flex flex-wrap gap-4 pt-2"
          >
            {DOC_TYPES.map((t) => (
              <div key={t} className="flex items-center space-x-2">
                <RadioGroupItem value={t} id={`doc-${t}`} />
                <Label htmlFor={`doc-${t}`}>{formatDocTypeLabel(t)}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        {!isEditing && nextInvoiceNumber != null && (
          <Alert variant="info">
            <span>
              Next invoice number: <strong>{String(nextInvoiceNumber).padStart(10, '0')}</strong>
            </span>
            <span className="ml-2 text-blue-600 text-xs">(assigned automatically on save)</span>
          </Alert>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="issueDate">Issue date *</Label>
            <Input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => onIssueDateChange(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="supplyDate">Tax event date</Label>
            <Input
              id="supplyDate"
              type="date"
              value={supplyDate}
              onChange={(e) => onSupplyDateChange(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Language</Label>
            <Select value={language} onValueChange={onLanguageChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Currency</Label>
            <Select value={currency} onValueChange={onCurrencyChange}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {currency === 'EUR' && (
          <div>
            <Label htmlFor="fxRate">FX rate (to BGN)</Label>
            <Input
              id="fxRate"
              type="number"
              step="0.000001"
              min="0"
              value={fxRate}
              onChange={(e) => onFxRateChange(Number(e.target.value) || 1)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
import { formatDocTypeLabel } from '@/src/features/bulgarian-invoicing/formatter';
import { LANGUAGES, CURRENCIES } from './types';
import { Alert } from '@/components/ui/alert';

// NEWINV-1: the new-document form creates only invoices and proformas. Credit
// and debit notes are raised from a finalized invoice's row menu (they must
// reference a parent), so they are intentionally not offered here.
const NEW_DOC_TYPES = ['invoice', 'proforma'] as const;

interface Props {
  docType: string;
  onDocTypeChange: (value: string) => void;
  isEditing: boolean;
  nextInvoiceNumber: number | null;
  manualNumber: string;
  onManualNumberChange: (value: string) => void;
  issueDate: string;
  onIssueDateChange: (value: string) => void;
  supplyDate: string;
  onSupplyDateChange: (value: string) => void;
  language: string;
  onLanguageChange: (value: string) => void;
  currency: string;
  onCurrencyChange: (value: string) => void;
}

export function DocumentCard({
  docType,
  onDocTypeChange,
  isEditing,
  nextInvoiceNumber,
  manualNumber,
  onManualNumberChange,
  issueDate,
  onIssueDateChange,
  supplyDate,
  onSupplyDateChange,
  language,
  onLanguageChange,
  currency,
  onCurrencyChange,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Документ</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Вид документ</Label>
          <RadioGroup
            value={docType}
            onValueChange={onDocTypeChange}
            className="flex flex-wrap gap-4 pt-2"
          >
            {NEW_DOC_TYPES.map((t) => (
              <div key={t} className="flex items-center space-x-2">
                <RadioGroupItem value={t} id={`doc-${t}`} />
                <Label htmlFor={`doc-${t}`}>{formatDocTypeLabel(t)}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        {!isEditing &&
          (docType === 'invoice' ? (
            <div>
              <Label htmlFor="manualNumber">Номер на документа</Label>
              <Input
                id="manualNumber"
                inputMode="numeric"
                className="mt-1"
                placeholder={
                  nextInvoiceNumber != null
                    ? `Автоматично: ${String(nextInvoiceNumber).padStart(10, '0')}`
                    : 'Автоматичен номер'
                }
                value={manualNumber}
                onChange={(e) =>
                  onManualNumberChange(e.target.value.replace(/[^\d]/g, ''))
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                Оставете празно за автоматичен номер. Ръчният номер трябва да е
                по-голям от последния използван.
              </p>
            </div>
          ) : (
            nextInvoiceNumber != null && (
              <Alert variant="info">
                <span>
                  Следващ номер:{' '}
                  <strong>{String(nextInvoiceNumber).padStart(10, '0')}</strong>
                </span>
                <span className="ml-2 text-blue-600 text-xs">
                  (присвоява се автоматично при запазване)
                </span>
              </Alert>
            )
          ))}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="issueDate">Дата на издаване *</Label>
            <Input
              id="issueDate"
              type="date"
              value={issueDate}
              onChange={(e) => onIssueDateChange(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="supplyDate">Дата на данъчно събитие</Label>
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
            <Label>Език</Label>
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
            <Label>Валута</Label>
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
      </CardContent>
    </Card>
  );
}

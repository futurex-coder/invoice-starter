'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Loader2 } from 'lucide-react';
import { FormField } from '@/components/forms/form-field';
import type { ValidationIssue } from '@/lib/actions/result';

export type ArticleType = 'service' | 'goods';

export interface ArticleForm {
  name: string;
  unit: string;
  tags: string;
  defaultUnitPrice: string;
  currency: string;
  type: ArticleType;
}

export const emptyArticleForm: ArticleForm = {
  name: '',
  unit: 'бр.',
  tags: '',
  defaultUnitPrice: '0',
  currency: 'EUR',
  type: 'service',
};

export function isArticleType(value: string): value is ArticleType {
  return value === 'service' || value === 'goods';
}

interface Props {
  isEditing: boolean;
  form: ArticleForm;
  onFormChange: (patch: Partial<ArticleForm>) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  validationErrors?: ValidationIssue[] | null;
}

export function ArticleFormCard({
  isEditing,
  form,
  onFormChange,
  saving,
  onSave,
  onCancel,
  validationErrors,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{isEditing ? 'Редактиране на артикул' : 'Нов артикул'}</CardTitle>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label="Затвори формата"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField name="name" label="Наименование" required errors={validationErrors}>
            <Input
              value={form.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
              placeholder="Наименование на артикула"
            />
          </FormField>
          <FormField name="unit" label="Мярка" required errors={validationErrors}>
            <Input
              value={form.unit}
              onChange={(e) => onFormChange({ unit: e.target.value })}
              placeholder="бр."
            />
          </FormField>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            name="defaultUnitPrice"
            label="Цена по подразбиране"
            errors={validationErrors}
          >
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.defaultUnitPrice}
              onChange={(e) => onFormChange({ defaultUnitPrice: e.target.value })}
              placeholder="0.00"
            />
          </FormField>
          <FormField name="currency" label="Валута" errors={validationErrors}>
            <Select
              value={form.currency}
              onValueChange={(v) => onFormChange({ currency: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="BGN">BGN</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField name="type" label="Вид" errors={validationErrors}>
            <Select
              value={form.type}
              onValueChange={(v) => {
                if (isArticleType(v)) onFormChange({ type: v });
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Услуга</SelectItem>
                <SelectItem value="goods">Стока</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField
          name="tags"
          label="Етикети"
          hint="етикети, разделени със запетая (по желание)"
          errors={validationErrors}
        >
          <Input
            value={form.tags}
            onChange={(e) => onFormChange({ tags: e.target.value })}
            placeholder="етикети, разделени със запетая"
          />
        </FormField>
        <div className="flex gap-2 pt-2">
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Запази' : 'Създай'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Отказ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

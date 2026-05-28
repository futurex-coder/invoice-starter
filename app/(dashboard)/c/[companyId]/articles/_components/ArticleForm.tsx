'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
}

export function ArticleFormCard({
  isEditing,
  form,
  onFormChange,
  saving,
  onSave,
  onCancel,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{isEditing ? 'Edit article' : 'New article'}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="aName">Name *</Label>
            <Input
              id="aName"
              value={form.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
              placeholder="Article name"
            />
          </div>
          <div>
            <Label htmlFor="aUnit">Unit *</Label>
            <Input
              id="aUnit"
              value={form.unit}
              onChange={(e) => onFormChange({ unit: e.target.value })}
              placeholder="бр."
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="aPrice">Default price</Label>
            <Input
              id="aPrice"
              type="number"
              min="0"
              step="0.01"
              value={form.defaultUnitPrice}
              onChange={(e) => onFormChange({ defaultUnitPrice: e.target.value })}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="aCurrency">Currency</Label>
            <Select
              value={form.currency}
              onValueChange={(v) => onFormChange({ currency: v })}
            >
              <SelectTrigger id="aCurrency" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="BGN">BGN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="aType">Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => {
                if (isArticleType(v)) onFormChange({ type: v });
              }}
            >
              <SelectTrigger id="aType" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="goods">Goods</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="aTags">Tags</Label>
          <Input
            id="aTags"
            value={form.tags}
            onChange={(e) => onFormChange({ tags: e.target.value })}
            placeholder="comma-separated tags (optional)"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button onClick={onSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Update' : 'Create'}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

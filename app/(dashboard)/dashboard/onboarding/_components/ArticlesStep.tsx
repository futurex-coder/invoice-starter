'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2, Check, Plus, X } from 'lucide-react';
import { UNITS, type ArticleRow } from './types';

interface Props {
  rows: ArticleRow[];
  onUpdateRow: (index: number, field: keyof ArticleRow, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
  saving: boolean;
  onSave: () => void;
  onSkip: () => void;
}

export function ArticlesStep({
  rows,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  saving,
  onSave,
  onSkip,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Your First Articles</CardTitle>
        <CardDescription>
          Optional — create catalog items you use on invoices.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((row, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto_auto_auto] sm:grid-cols-[1fr_120px_100px_36px] gap-2 items-end"
          >
            <div>
              <Label htmlFor={`ob-art-name-${i}`}>
                {i === 0 ? 'Article name *' : ''}
              </Label>
              <Input
                id={`ob-art-name-${i}`}
                value={row.name}
                onChange={(e) => onUpdateRow(i, 'name', e.target.value)}
                placeholder="Article name"
              />
            </div>
            <div>
              <Label htmlFor={`ob-art-unit-${i}`}>{i === 0 ? 'Unit' : ''}</Label>
              <select
                id={`ob-art-unit-${i}`}
                className="block w-full h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm"
                value={row.unit}
                onChange={(e) => onUpdateRow(i, 'unit', e.target.value)}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={`ob-art-price-${i}`}>{i === 0 ? 'Price' : ''}</Label>
              <Input
                id={`ob-art-price-${i}`}
                type="number"
                min="0"
                step="0.01"
                value={row.defaultUnitPrice}
                onChange={(e) => onUpdateRow(i, 'defaultUnitPrice', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              {rows.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-gray-400 hover:text-red-500"
                  onClick={() => onRemoveRow(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={onAddRow} className="mt-2">
          <Plus className="mr-2 h-4 w-4" />
          Add another
        </Button>

        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Skip
          </button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Check className="mr-2 h-4 w-4" />
            )}
            Save &amp; Finish
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

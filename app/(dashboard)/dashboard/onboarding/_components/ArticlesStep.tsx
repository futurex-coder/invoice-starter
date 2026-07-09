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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
        <CardTitle>Добавете първите си артикули</CardTitle>
        <CardDescription>
          По желание — създайте артикули от каталога, които използвате във фактурите.
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
                {i === 0 ? 'Име на артикул *' : ''}
              </Label>
              <Input
                id={`ob-art-name-${i}`}
                value={row.name}
                onChange={(e) => onUpdateRow(i, 'name', e.target.value)}
                placeholder="Име на артикул"
              />
            </div>
            <div>
              <Label htmlFor={`ob-art-unit-${i}`}>{i === 0 ? 'Мярка' : ''}</Label>
              <Select
                value={row.unit}
                onValueChange={(v) => onUpdateRow(i, 'unit', v)}
              >
                <SelectTrigger id={`ob-art-unit-${i}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`ob-art-price-${i}`}>{i === 0 ? 'Цена' : ''}</Label>
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
                  aria-label="Премахни ред"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={onAddRow} className="mt-2">
          <Plus className="mr-2 h-4 w-4" />
          Добави още
        </Button>

        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Пропусни
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
            Запази и завърши
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

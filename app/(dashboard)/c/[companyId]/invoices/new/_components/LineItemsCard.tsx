'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { EntityPicker } from '@/components/forms/entity-picker';
import { calculateInvoice } from '@/src/features/bulgarian-invoicing';
import type { BgVatRate } from '@/src/features/bulgarian-invoicing/types';
import type { Article } from '@/lib/db/schema';
import type { LineItemForm, VatMode } from './types';

interface Props {
  lineItems: LineItemForm[];
  articles: Article[];
  isVatRegistered: boolean;
  defaultVatRate: BgVatRate;
  effectiveVatRate: BgVatRate;
  vatMode: VatMode;
  onVatModeChange: (mode: VatMode) => void;
  noVatReason: string;
  onNoVatReasonChange: (reason: string) => void;
  onUpdateLine: (index: number, patch: Partial<LineItemForm>) => void;
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
}

export function LineItemsCard({
  lineItems,
  articles,
  isVatRegistered,
  defaultVatRate,
  effectiveVatRate,
  vatMode,
  onVatModeChange,
  noVatReason,
  onNoVatReasonChange,
  onUpdateLine,
  onAddLine,
  onRemoveLine,
}: Props) {
  const itemsWithVat = lineItems.map((item) => ({ ...item, vatRate: effectiveVatRate }));
  const calc = calculateInvoice(itemsWithVat);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Items</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isVatRegistered && (
          <p className="text-sm text-amber-700">Supplier is not VAT registered. VAT is 0%.</p>
        )}
        {isVatRegistered && (
          <div>
            <Label>VAT</Label>
            <RadioGroup
              value={vatMode}
              onValueChange={(v) => onVatModeChange(v === 'no_vat' ? 'no_vat' : 'standard')}
              className="flex gap-4 pt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="standard" id="vat-standard" />
                <Label htmlFor="vat-standard">Standard ({defaultVatRate}%)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no_vat" id="vat-no" />
                <Label htmlFor="vat-no">No VAT</Label>
              </div>
            </RadioGroup>
            {vatMode === 'no_vat' && (
              <Input
                className="mt-2"
                placeholder="Reason for no VAT"
                value={noVatReason}
                onChange={(e) => onNoVatReasonChange(e.target.value)}
              />
            )}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Article / Description</th>
                <th className="text-left py-2 w-20">Qty</th>
                <th className="text-left py-2 w-20">Unit</th>
                <th className="text-left py-2 w-24">Unit price</th>
                <th className="text-left py-2 w-20">Disc.%</th>
                <th className="text-right py-2 w-24">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line, i) => {
                const lineTotal = calc.items[i]?.grossAmount ?? 0;
                return (
                  <tr key={i} className="border-b">
                    <td className="py-1">
                      <div className="space-y-1">
                        <EntityPicker
                          className="h-8 max-w-[200px]"
                          items={articles}
                          value={line.articleId ?? null}
                          onChange={(v) => {
                            if (v === null) {
                              onUpdateLine(i, { articleId: null });
                              return;
                            }
                            const art = articles.find((a) => a.id === v);
                            if (art) {
                              onUpdateLine(i, {
                                articleId: art.id,
                                description: art.name,
                                unit: art.unit,
                                unitPrice: Number(art.defaultUnitPrice),
                              });
                            } else {
                              onUpdateLine(i, { articleId: null });
                            }
                          }}
                          getKey={(a) => a.id}
                          getLabel={(a) => a.name}
                          getSearchText={(a) => `${a.name} ${a.unit}`}
                          placeholder="From article..."
                          clearLabel="From article..."
                          emptyMessage="No articles match"
                        />
                        <Input
                          className="max-w-[200px]"
                          placeholder="Description *"
                          value={line.description}
                          onChange={(e) => onUpdateLine(i, { description: e.target.value })}
                        />
                      </div>
                    </td>
                    <td className="py-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-8 w-20"
                        value={line.quantity}
                        onChange={(e) => onUpdateLine(i, { quantity: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1">
                      <Input
                        className="h-8 w-20"
                        value={line.unit}
                        onChange={(e) => onUpdateLine(i, { unit: e.target.value })}
                      />
                    </td>
                    <td className="py-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-8 w-24"
                        value={line.unitPrice}
                        onChange={(e) => onUpdateLine(i, { unitPrice: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        className="h-8 w-20"
                        value={line.discountPercent ?? 0}
                        onChange={(e) => onUpdateLine(i, { discountPercent: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="py-1 text-right font-medium">{lineTotal.toFixed(2)}</td>
                    <td className="py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveLine(i)}
                        disabled={lineItems.length <= 1}
                      >
                        ×
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onAddLine}>
          + Add line
        </Button>
      </CardContent>
    </Card>
  );
}

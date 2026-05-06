'use client';

import { useMemo, useState } from 'react';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { calculateReceivedInvoice } from '@/src/features/received-invoices/calculator';
import type {
  AccountingStatus,
  PaymentMethod,
  PaymentStatus,
  ReceivedInvoiceLineInput,
  ReceivedInvoiceReviewInput,
  SupplierSnapshot,
} from '@/src/features/received-invoices/types';

const PAYMENT_METHODS: PaymentMethod[] = ['bank', 'cash', 'barter'];
const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'partial', 'paid'];
const ACCOUNTING_STATUSES: AccountingStatus[] = ['pending', 'accounted'];
const CURRENCIES = ['EUR', 'BGN', 'USD'];
const VAT_RATES: Array<0 | 9 | 20> = [0, 9, 20];

const blankLine: ReceivedInvoiceLineInput = {
  description: '',
  quantity: 1,
  unit: 'бр.',
  unitPrice: 0,
  vatRate: 20,
  discountPercent: 0,
};

interface FieldHighlight {
  fields: Set<string>;
}

function lowConfidenceFields(confidence: string | null | undefined): FieldHighlight {
  // For "low" confidence, highlight nearly everything that's likely shaky.
  // For "medium", highlight key numeric fields. For "high", no highlights.
  if (confidence === 'low') {
    return {
      fields: new Set([
        'supplier.legalName',
        'supplier.eik',
        'invoiceNumber',
        'issueDate',
        'dueDate',
        'currency',
        'lineItems',
      ]),
    };
  }
  if (confidence === 'medium') {
    return {
      fields: new Set(['invoiceNumber', 'lineItems']),
    };
  }
  return { fields: new Set() };
}

function fieldRing(highlight: FieldHighlight, key: string, touched: boolean) {
  if (touched || !highlight.fields.has(key)) return '';
  return 'ring-1 ring-amber-300 bg-amber-50/40';
}

interface Props {
  initial: ReceivedInvoiceReviewInput;
  extractionConfidence?: string | null;
  partnerSuggestion?: { matchedPartnerId: number; matchedPartnerName: string } | null;
  onSaveDraft: (patch: ReceivedInvoiceReviewInput) => Promise<void>;
  onConfirm: (patch: ReceivedInvoiceReviewInput) => Promise<void>;
  onDiscard: () => Promise<void>;
  saving: boolean;
}

export function ReviewForm({
  initial,
  extractionConfidence,
  partnerSuggestion,
  onSaveDraft,
  onConfirm,
  onDiscard,
  saving,
}: Props) {
  const [partnerId, setPartnerId] = useState<number | null>(
    initial.partnerId ?? null
  );
  const [supplier, setSupplier] = useState<SupplierSnapshot>(initial.supplier);
  const [createPartnerOnConfirm, setCreatePartnerOnConfirm] = useState(
    initial.createPartnerOnConfirm
  );
  const [invoiceNumber, setInvoiceNumber] = useState(initial.invoiceNumber ?? '');
  const [issueDate, setIssueDate] = useState(initial.issueDate ?? '');
  const [supplyDate, setSupplyDate] = useState(initial.supplyDate ?? '');
  const [dueDate, setDueDate] = useState(initial.dueDate ?? '');
  const [currency, setCurrency] = useState(initial.currency);
  const [fxRate, setFxRate] = useState(initial.fxRate);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    initial.paymentMethod
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    initial.paymentStatus
  );
  const [accountingStatus, setAccountingStatus] = useState<AccountingStatus>(
    initial.accountingStatus
  );
  const [lineItems, setLineItems] = useState<ReceivedInvoiceLineInput[]>(
    initial.lineItems.length > 0 ? initial.lineItems : [{ ...blankLine }]
  );
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const highlight = useMemo(
    () => lowConfidenceFields(extractionConfidence),
    [extractionConfidence]
  );

  const markTouched = (key: string) => {
    if (touched.has(key)) return;
    setTouched((prev) => new Set(prev).add(key));
  };

  const updateLine = (i: number, patch: Partial<ReceivedInvoiceLineInput>) => {
    markTouched('lineItems');
    setLineItems((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const addLine = () => {
    markTouched('lineItems');
    setLineItems((prev) => [...prev, { ...blankLine }]);
  };

  const removeLine = (i: number) => {
    if (lineItems.length <= 1) return;
    markTouched('lineItems');
    setLineItems((prev) => prev.filter((_, idx) => idx !== i));
  };

  const totals = useMemo(() => {
    const calc = calculateReceivedInvoice(lineItems);
    return calc.totals;
  }, [lineItems]);

  const buildPatch = (): ReceivedInvoiceReviewInput => ({
    partnerId,
    supplier,
    createPartnerOnConfirm,
    invoiceNumber: invoiceNumber.trim() || null,
    issueDate: issueDate || null,
    supplyDate: supplyDate || null,
    dueDate: dueDate || null,
    currency,
    fxRate,
    paymentMethod,
    paymentStatus,
    accountingStatus,
    lineItems,
    notes: notes.trim() || null,
  });

  const linkSuggestedPartner = () => {
    if (!partnerSuggestion) return;
    setPartnerId(partnerSuggestion.matchedPartnerId);
    setCreatePartnerOnConfirm(false);
  };

  const unlinkPartner = () => {
    setPartnerId(null);
    setCreatePartnerOnConfirm(true);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Доставчик (Supplier)</CardTitle>
          {partnerId && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-medium uppercase text-green-800">
              Linked partner
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {partnerSuggestion && !partnerId && (
            <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              <div className="flex-1">
                <p className="text-blue-900">
                  EIK matches existing partner{' '}
                  <strong>{partnerSuggestion.matchedPartnerName}</strong>.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="link"
                  className="h-auto p-0 text-blue-700"
                  onClick={linkSuggestedPartner}
                >
                  Link this invoice to that partner
                </Button>
              </div>
            </div>
          )}

          {partnerId && (
            <div className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
              <span>
                Linked to partner #{partnerId}
                {partnerSuggestion?.matchedPartnerId === partnerId && (
                  <> — {partnerSuggestion.matchedPartnerName}</>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={unlinkPartner}
              >
                Edit manually
              </Button>
            </div>
          )}

          {!partnerId && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="supplierName">Legal name *</Label>
                  <Input
                    id="supplierName"
                    className={cn(
                      fieldRing(highlight, 'supplier.legalName', touched.has('supplier.legalName'))
                    )}
                    value={supplier.legalName ?? ''}
                    onChange={(e) => {
                      markTouched('supplier.legalName');
                      setSupplier((s) => ({
                        ...s,
                        legalName: e.target.value,
                      }));
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="supplierEik">EIK</Label>
                  <Input
                    id="supplierEik"
                    className={cn(
                      fieldRing(highlight, 'supplier.eik', touched.has('supplier.eik'))
                    )}
                    value={supplier.eik ?? ''}
                    onChange={(e) => {
                      markTouched('supplier.eik');
                      setSupplier((s) => ({ ...s, eik: e.target.value }));
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="supplierVat">VAT number</Label>
                  <Input
                    id="supplierVat"
                    value={supplier.vatNumber ?? ''}
                    onChange={(e) =>
                      setSupplier((s) => ({ ...s, vatNumber: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="supplierCity">City</Label>
                  <Input
                    id="supplierCity"
                    value={supplier.city ?? ''}
                    onChange={(e) =>
                      setSupplier((s) => ({ ...s, city: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="supplierStreet">Street</Label>
                  <Input
                    id="supplierStreet"
                    value={supplier.street ?? ''}
                    onChange={(e) =>
                      setSupplier((s) => ({ ...s, street: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="supplierCountry">Country</Label>
                  <Input
                    id="supplierCountry"
                    maxLength={2}
                    value={supplier.country ?? ''}
                    onChange={(e) =>
                      setSupplier((s) => ({ ...s, country: e.target.value }))
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={createPartnerOnConfirm}
                  onChange={(e) => setCreatePartnerOnConfirm(e.target.checked)}
                />
                Save as new partner on confirm
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="invoiceNumber">Invoice number</Label>
              <Input
                id="invoiceNumber"
                className={cn(
                  fieldRing(highlight, 'invoiceNumber', touched.has('invoiceNumber'))
                )}
                value={invoiceNumber}
                onChange={(e) => {
                  markTouched('invoiceNumber');
                  setInvoiceNumber(e.target.value);
                }}
                placeholder="Supplier's number"
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                className={cn(
                  'mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm',
                  fieldRing(highlight, 'currency', touched.has('currency'))
                )}
                value={currency}
                onChange={(e) => {
                  markTouched('currency');
                  setCurrency(e.target.value);
                }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="issueDate">Issue date *</Label>
              <Input
                id="issueDate"
                type="date"
                className={cn(
                  fieldRing(highlight, 'issueDate', touched.has('issueDate'))
                )}
                value={issueDate}
                onChange={(e) => {
                  markTouched('issueDate');
                  setIssueDate(e.target.value);
                }}
              />
            </div>
            <div>
              <Label htmlFor="supplyDate">Tax event date</Label>
              <Input
                id="supplyDate"
                type="date"
                value={supplyDate}
                onChange={(e) => setSupplyDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                className={cn(
                  fieldRing(highlight, 'dueDate', touched.has('dueDate'))
                )}
                value={dueDate}
                onChange={(e) => {
                  markTouched('dueDate');
                  setDueDate(e.target.value);
                }}
              />
            </div>
          </div>
          {currency !== 'EUR' && (
            <div>
              <Label htmlFor="fxRate">FX rate to EUR</Label>
              <Input
                id="fxRate"
                type="number"
                step="0.000001"
                min="0"
                value={fxRate}
                onChange={(e) => setFxRate(Number(e.target.value) || 1)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left">Description</th>
                  <th className="w-20 py-2 text-left">Qty</th>
                  <th className="w-20 py-2 text-left">Unit</th>
                  <th className="w-24 py-2 text-left">Unit price</th>
                  <th className="w-20 py-2 text-left">VAT %</th>
                  <th className="w-20 py-2 text-left">Disc. %</th>
                  <th className="w-24 py-2 text-right">Gross</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {lineItems.map((line, i) => {
                  const calc = calculateReceivedInvoice(lineItems).items[i];
                  return (
                    <tr key={i} className="border-b">
                      <td className="py-1">
                        <Input
                          value={line.description}
                          onChange={(e) =>
                            updateLine(i, { description: e.target.value })
                          }
                          placeholder="Description *"
                        />
                      </td>
                      <td className="py-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 w-20"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(i, {
                              quantity: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="py-1">
                        <Input
                          className="h-8 w-20"
                          value={line.unit}
                          onChange={(e) =>
                            updateLine(i, { unit: e.target.value })
                          }
                        />
                      </td>
                      <td className="py-1">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 w-24"
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(i, {
                              unitPrice: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="py-1">
                        <select
                          className="h-8 w-16 rounded border px-2 text-sm"
                          value={line.vatRate}
                          onChange={(e) =>
                            updateLine(i, {
                              vatRate: Number(e.target.value) as 0 | 9 | 20,
                            })
                          }
                        >
                          {VAT_RATES.map((r) => (
                            <option key={r} value={r}>
                              {r}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1">
                        <Input
                          type="number"
                          step="0.5"
                          min="0"
                          max="100"
                          className="h-8 w-20"
                          value={line.discountPercent}
                          onChange={(e) =>
                            updateLine(i, {
                              discountPercent: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="py-1 text-right font-medium">
                        {(calc?.grossAmount ?? 0).toFixed(2)}
                      </td>
                      <td className="py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(i)}
                          disabled={lineItems.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLine}
            className="mt-3"
          >
            <Plus className="mr-1 h-3 w-3" />
            Add line
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Tax base (net)</span>
            <span>
              {totals.netAmount.toFixed(2)} {currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">VAT</span>
            <span>
              {totals.vatAmount.toFixed(2)} {currency}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1.5 font-medium">
            <span>Total</span>
            <span>
              {totals.grossAmount.toFixed(2)} {currency}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment & accounting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Method</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              className="flex gap-4 pt-2"
            >
              {PAYMENT_METHODS.map((m) => (
                <div key={m} className="flex items-center space-x-2">
                  <RadioGroupItem value={m} id={`pay-${m}`} />
                  <Label htmlFor={`pay-${m}`}>{m}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="paymentStatus">Payment status</Label>
              <select
                id="paymentStatus"
                className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={paymentStatus}
                onChange={(e) =>
                  setPaymentStatus(e.target.value as PaymentStatus)
                }
              >
                {PAYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="accountingStatus">Accounting status</Label>
              <select
                id="accountingStatus"
                className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={accountingStatus}
                onChange={(e) =>
                  setAccountingStatus(e.target.value as AccountingStatus)
                }
              >
                {ACCOUNTING_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="block min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional internal notes"
          />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-gray-200 bg-white/95 py-3 backdrop-blur">
        <Button
          variant="outline"
          onClick={() => onSaveDraft(buildPatch())}
          disabled={saving}
        >
          Save draft
        </Button>
        <Button
          variant="outline"
          onClick={onDiscard}
          disabled={saving}
          className="text-red-700 hover:bg-red-50"
        >
          Discard
        </Button>
        <Button
          className="ml-auto bg-green-600 hover:bg-green-700"
          onClick={() => onConfirm(buildPatch())}
          disabled={saving}
        >
          Confirm
        </Button>
      </div>
    </div>
  );
}

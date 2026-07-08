'use client';

import { useMemo, useReducer, useState } from 'react';
import {
  Trash2,
  Plus,
  Info,
  Building2,
  FileText,
  ListChecks,
  Calculator,
  CreditCard,
  StickyNote,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { calculateReceivedInvoice } from '@/src/features/received-invoices/calculator';
import type {
  AccountingStatus,
  PaymentMethod,
  PaymentStatus,
  ReceivedInvoiceLineInput,
  ReceivedInvoiceReviewInput,
} from '@/src/features/received-invoices/types';
import {
  parseAccountingStatus,
  parsePaymentMethod,
  parsePaymentStatus,
} from '@/src/features/received-invoices/parsers';
import type {
  ExtractedInvoice,
  FieldConfidence,
} from '@/app/api/invoices/extract/schema';
import { formReducer, makeInitialFormState } from './review-form-state';

const PAYMENT_METHODS: PaymentMethod[] = ['bank', 'cash', 'barter'];
const PAYMENT_STATUSES: PaymentStatus[] = ['unpaid', 'partial', 'paid'];
const ACCOUNTING_STATUSES: AccountingStatus[] = ['pending', 'accounted'];
const CURRENCIES = ['EUR', 'BGN', 'USD'];
const VAT_RATES: Array<0 | 9 | 20> = [0, 9, 20];

function parseVatRate(value: string): 0 | 9 | 20 {
  const n = Number(value);
  if (n === 0 || n === 9 || n === 20) return n;
  return 20;
}

// Map of UI field key → { confidence, reason } sourced from the raw extraction.
type FieldMeta = { confidence: FieldConfidence; reason?: string | null };
type FieldMetaMap = Map<string, FieldMeta>;

function buildFieldMeta(
  raw: ExtractedInvoice | null,
  overall: string | null | undefined
): FieldMetaMap {
  const m: FieldMetaMap = new Map();
  if (!raw) {
    // Without per-field data, fall back to overall confidence — the UI keys
    // most likely to be shaky on a low-confidence document.
    if (overall === 'low') {
      const fallback: FieldConfidence = 'low';
      [
        'supplier.legalName',
        'supplier.eik',
        'supplier.street',
        'supplier.city',
        'invoiceNumber',
        'issueDate',
        'currency',
        'lineItems',
      ].forEach((k) => m.set(k, { confidence: fallback }));
    } else if (overall === 'medium') {
      const fallback: FieldConfidence = 'medium';
      ['invoiceNumber', 'lineItems'].forEach((k) =>
        m.set(k, { confidence: fallback })
      );
    }
    return m;
  }

  // Direct mappings from extraction key → form key.
  const set = (
    formKey: string,
    field:
      | { confidence: FieldConfidence; reason?: string | null }
      | undefined
  ) => {
    if (!field) return;
    m.set(formKey, { confidence: field.confidence, reason: field.reason });
  };

  set('invoiceNumber', raw.invoice_number);
  set('issueDate', raw.issue_date);
  set('supplyDate', raw.supply_date);
  set('currency', raw.currency);
  set('supplier.legalName', raw.supplier_name);
  set('supplier.eik', raw.supplier_eik);
  set('supplier.vatNumber', raw.supplier_vat_number);
  set('supplier.street', raw.supplier_address_street);
  set('supplier.city', raw.supplier_address_city);
  set('supplier.country', raw.supplier_address_country);
  set('supplier.postCode', raw.supplier_address_post_code);

  if (raw.line_items_confidence) {
    m.set('lineItems', { confidence: raw.line_items_confidence });
  }
  return m;
}

function isShaky(c: FieldConfidence | undefined): boolean {
  return c === 'low' || c === 'medium' || c === 'missing';
}

function fieldRing(
  meta: FieldMetaMap,
  key: string,
  touched: boolean
): string {
  if (touched) return '';
  const m = meta.get(key);
  if (!m || !isShaky(m.confidence)) return '';
  if (m.confidence === 'missing') {
    return 'ring-1 ring-rose-300 bg-rose-50/30';
  }
  return 'ring-1 ring-amber-300 bg-amber-50/40';
}

function FieldHint({
  meta,
  formKey,
  touched,
}: {
  meta: FieldMetaMap;
  formKey: string;
  touched: boolean;
}) {
  if (touched) return null;
  const m = meta.get(formKey);
  if (!m || !isShaky(m.confidence)) return null;
  const text =
    m.reason ??
    (m.confidence === 'missing'
      ? 'Not found on the document — please fill in.'
      : `Low-confidence extraction (${m.confidence}). Please verify.`);
  const tone =
    m.confidence === 'missing' ? 'text-rose-700' : 'text-amber-700';
  return (
    <p className={cn('mt-1 inline-flex items-start gap-1 text-xs', tone)}>
      <Info className="mt-0.5 h-3 w-3 shrink-0" />
      <span>{text}</span>
    </p>
  );
}

interface Props {
  initial: ReceivedInvoiceReviewInput;
  extractionConfidence?: string | null;
  rawExtraction?: ExtractedInvoice | null;
  partnerSuggestion?: { matchedPartnerId: number; matchedPartnerName: string } | null;
  onSaveDraft: (patch: ReceivedInvoiceReviewInput) => Promise<void>;
  onConfirm: (patch: ReceivedInvoiceReviewInput) => Promise<void>;
  onDiscard: () => Promise<void>;
  saving: boolean;
}

export function ReviewForm({
  initial,
  extractionConfidence,
  rawExtraction,
  partnerSuggestion,
  onSaveDraft,
  onConfirm,
  onDiscard,
  saving,
}: Props) {
  const [state, dispatch] = useReducer(
    formReducer,
    undefined,
    () => makeInitialFormState(initial)
  );
  const {
    partnerId,
    supplier,
    createPartnerOnConfirm,
    invoiceNumber,
    issueDate,
    supplyDate,
    dueDate,
    currency,
    fxRate,
    paymentMethod,
    paymentStatus,
    accountingStatus,
    lineItems,
    notes,
  } = state;
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const fieldMeta = useMemo(
    () => buildFieldMeta(rawExtraction ?? null, extractionConfidence),
    [rawExtraction, extractionConfidence]
  );

  const markTouched = (key: string) => {
    if (touched.has(key)) return;
    setTouched((prev) => new Set(prev).add(key));
  };

  const updateLine = (i: number, patch: Partial<ReceivedInvoiceLineInput>) => {
    markTouched('lineItems');
    dispatch({ type: 'UPDATE_LINE', index: i, patch });
  };

  const addLine = () => {
    markTouched('lineItems');
    dispatch({ type: 'ADD_LINE' });
  };

  const removeLine = (i: number) => {
    if (lineItems.length <= 1) return;
    markTouched('lineItems');
    dispatch({ type: 'REMOVE_LINE', index: i });
  };

  const { items: calculatedItems, totals } = useMemo(
    () => calculateReceivedInvoice(lineItems),
    [lineItems]
  );

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
    dispatch({
      type: 'LINK_PARTNER',
      partnerId: partnerSuggestion.matchedPartnerId,
    });
  };

  const unlinkPartner = () => {
    dispatch({ type: 'UNLINK_PARTNER' });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-400" />
            Доставчик (Supplier)
          </CardTitle>
          {partnerId && (
            <span className="rounded bg-green-100 px-2 py-0.5 text-[10px] font-medium uppercase text-green-800">
              Linked partner
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {partnerSuggestion && !partnerId && (
            <Alert variant="info">
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
            </Alert>
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
                      fieldRing(fieldMeta, 'supplier.legalName', touched.has('supplier.legalName'))
                    )}
                    value={supplier.legalName ?? ''}
                    onChange={(e) => {
                      markTouched('supplier.legalName');
                      dispatch({
                        type: 'SET_SUPPLIER',
                        patch: { legalName: e.target.value },
                      });
                    }}
                  />
                  <FieldHint
                    meta={fieldMeta}
                    formKey="supplier.legalName"
                    touched={touched.has('supplier.legalName')}
                  />
                </div>
                <div>
                  <Label htmlFor="supplierEik">EIK</Label>
                  <Input
                    id="supplierEik"
                    className={cn(
                      fieldRing(fieldMeta, 'supplier.eik', touched.has('supplier.eik'))
                    )}
                    value={supplier.eik ?? ''}
                    onChange={(e) => {
                      markTouched('supplier.eik');
                      dispatch({
                        type: 'SET_SUPPLIER',
                        patch: { eik: e.target.value },
                      });
                    }}
                  />
                  <FieldHint
                    meta={fieldMeta}
                    formKey="supplier.eik"
                    touched={touched.has('supplier.eik')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="supplierVat">VAT number</Label>
                  <Input
                    id="supplierVat"
                    className={cn(
                      fieldRing(fieldMeta, 'supplier.vatNumber', touched.has('supplier.vatNumber'))
                    )}
                    value={supplier.vatNumber ?? ''}
                    onChange={(e) => {
                      markTouched('supplier.vatNumber');
                      dispatch({
                        type: 'SET_SUPPLIER',
                        patch: { vatNumber: e.target.value },
                      });
                    }}
                  />
                  <FieldHint
                    meta={fieldMeta}
                    formKey="supplier.vatNumber"
                    touched={touched.has('supplier.vatNumber')}
                  />
                </div>
                <div>
                  <Label htmlFor="supplierCity">City</Label>
                  <Input
                    id="supplierCity"
                    className={cn(
                      fieldRing(fieldMeta, 'supplier.city', touched.has('supplier.city'))
                    )}
                    value={supplier.city ?? ''}
                    onChange={(e) => {
                      markTouched('supplier.city');
                      dispatch({
                        type: 'SET_SUPPLIER',
                        patch: { city: e.target.value },
                      });
                    }}
                  />
                  <FieldHint
                    meta={fieldMeta}
                    formKey="supplier.city"
                    touched={touched.has('supplier.city')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Label htmlFor="supplierStreet">Street</Label>
                  <Input
                    id="supplierStreet"
                    className={cn(
                      fieldRing(fieldMeta, 'supplier.street', touched.has('supplier.street'))
                    )}
                    value={supplier.street ?? ''}
                    onChange={(e) => {
                      markTouched('supplier.street');
                      dispatch({
                        type: 'SET_SUPPLIER',
                        patch: { street: e.target.value },
                      });
                    }}
                  />
                  <FieldHint
                    meta={fieldMeta}
                    formKey="supplier.street"
                    touched={touched.has('supplier.street')}
                  />
                </div>
                <div>
                  <Label htmlFor="supplierPostCode">Post code</Label>
                  <Input
                    id="supplierPostCode"
                    className={cn(
                      fieldRing(fieldMeta, 'supplier.postCode', touched.has('supplier.postCode'))
                    )}
                    value={supplier.postCode ?? ''}
                    onChange={(e) => {
                      markTouched('supplier.postCode');
                      dispatch({
                        type: 'SET_SUPPLIER',
                        patch: { postCode: e.target.value },
                      });
                    }}
                  />
                  <FieldHint
                    meta={fieldMeta}
                    formKey="supplier.postCode"
                    touched={touched.has('supplier.postCode')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="supplierCountry">Country</Label>
                  <Input
                    id="supplierCountry"
                    maxLength={2}
                    className={cn(
                      fieldRing(fieldMeta, 'supplier.country', touched.has('supplier.country'))
                    )}
                    value={supplier.country ?? ''}
                    onChange={(e) => {
                      markTouched('supplier.country');
                      dispatch({
                        type: 'SET_SUPPLIER',
                        patch: { country: e.target.value },
                      });
                    }}
                  />
                  <FieldHint
                    meta={fieldMeta}
                    formKey="supplier.country"
                    touched={touched.has('supplier.country')}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={createPartnerOnConfirm}
                  onChange={(e) =>
                    dispatch({
                      type: 'SET',
                      patch: { createPartnerOnConfirm: e.target.checked },
                    })
                  }
                />
                Save as new partner on confirm
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-400" />
            Document
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="invoiceNumber">Invoice number</Label>
              <Input
                id="invoiceNumber"
                className={cn(
                  fieldRing(fieldMeta, 'invoiceNumber', touched.has('invoiceNumber'))
                )}
                value={invoiceNumber}
                onChange={(e) => {
                  markTouched('invoiceNumber');
                  dispatch({
                    type: 'SET',
                    patch: { invoiceNumber: e.target.value },
                  });
                }}
                placeholder="Supplier's number"
              />
              <FieldHint
                meta={fieldMeta}
                formKey="invoiceNumber"
                touched={touched.has('invoiceNumber')}
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => {
                  markTouched('currency');
                  dispatch({ type: 'SET', patch: { currency: v } });
                }}
              >
                <SelectTrigger
                  id="currency"
                  className={cn(
                    'mt-1',
                    fieldRing(fieldMeta, 'currency', touched.has('currency'))
                  )}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint
                meta={fieldMeta}
                formKey="currency"
                touched={touched.has('currency')}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="issueDate">Issue date *</Label>
              <Input
                id="issueDate"
                type="date"
                className={cn(
                  fieldRing(fieldMeta, 'issueDate', touched.has('issueDate'))
                )}
                value={issueDate}
                onChange={(e) => {
                  markTouched('issueDate');
                  dispatch({
                    type: 'SET',
                    patch: { issueDate: e.target.value },
                  });
                }}
              />
              <FieldHint
                meta={fieldMeta}
                formKey="issueDate"
                touched={touched.has('issueDate')}
              />
            </div>
            <div>
              <Label htmlFor="supplyDate">Tax event date</Label>
              <Input
                id="supplyDate"
                type="date"
                value={supplyDate}
                onChange={(e) =>
                  dispatch({
                    type: 'SET',
                    patch: { supplyDate: e.target.value },
                  })
                }
              />
            </div>
            {/* Due date removed per RV-2 — state still carries `dueDate` so
                re-saving an old row preserves its stored value. */}
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
                onChange={(e) =>
                  dispatch({
                    type: 'SET',
                    patch: { fxRate: Number(e.target.value) || 1 },
                  })
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-gray-400" />
            Items
          </CardTitle>
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
                  const calc = calculatedItems[i];
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
                        <Select
                          value={String(line.vatRate)}
                          onValueChange={(v) =>
                            updateLine(i, { vatRate: parseVatRate(v) })
                          }
                        >
                          <SelectTrigger className="h-8 w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VAT_RATES.map((r) => (
                              <SelectItem key={r} value={String(r)}>
                                {r}%
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          aria-label="Remove line"
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
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-gray-400" />
            Totals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Tax base (net)</span>
            <span className="tabular-nums">
              {totals.netAmount.toFixed(2)} {currency}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">VAT</span>
            <span className="tabular-nums">
              {totals.vatAmount.toFixed(2)} {currency}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between border-t pt-2">
            <span className="font-medium">Total</span>
            <span className="text-lg font-semibold tabular-nums">
              {totals.grossAmount.toFixed(2)} {currency}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gray-400" />
            Payment & accounting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Method</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) =>
                dispatch({
                  type: 'SET',
                  patch: { paymentMethod: parsePaymentMethod(v) },
                })
              }
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
              <Select
                value={paymentStatus}
                onValueChange={(v) =>
                  dispatch({
                    type: 'SET',
                    patch: { paymentStatus: parsePaymentStatus(v) },
                  })
                }
              >
                <SelectTrigger id="paymentStatus" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="accountingStatus">Accounting status</Label>
              <Select
                value={accountingStatus}
                onValueChange={(v) =>
                  dispatch({
                    type: 'SET',
                    patch: { accountingStatus: parseAccountingStatus(v) },
                  })
                }
              >
                <SelectTrigger id="accountingStatus" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-gray-400" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="block min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={notes}
            onChange={(e) =>
              dispatch({ type: 'SET', patch: { notes: e.target.value } })
            }
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
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">
              Total
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {totals.grossAmount.toFixed(2)} {currency}
            </div>
          </div>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onConfirm(buildPatch())}
            disabled={saving}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
import { getCompanyProfile } from '@/src/features/invoicing/actions';
import { listPartners } from '@/src/features/invoicing/actions';
import { listArticles } from '@/src/features/invoicing/actions';
import {
  createInvoiceDraft,
  updateInvoiceDraft,
  finalizeInvoice,
  getInvoice,
  getInvoiceLines,
} from '@/src/features/bulgarian-invoicing/actions';
import type { RecipientInput, LineItemWithArticle } from '@/src/features/bulgarian-invoicing/actions';
import { calculateInvoice, amountInWordsBg } from '@/src/features/bulgarian-invoicing';
import type { PartySnapshot, LineItemInput, BgVatRate } from '@/src/features/bulgarian-invoicing/types';
import type { TeamCompanyProfile } from '@/lib/db/schema';
import type { Partner } from '@/lib/db/schema';
import type { Article } from '@/lib/db/schema';
import { DOC_TYPES, BG_VAT_RATES } from '@/src/features/bulgarian-invoicing/types';
import { formatDocTypeLabel } from '@/src/features/bulgarian-invoicing/formatter';
import { ArrowLeft, Loader2, Save, FileText, CheckCircle } from 'lucide-react';

const PAYMENT_METHODS = ['bank', 'cash', 'barter'] as const;
const LANGUAGES = [{ value: 'bg', label: 'Български' }, { value: 'en', label: 'English' }];
const CURRENCIES = ['BGN', 'EUR'];

interface RecipientForm {
  name: string;
  eik: string;
  vatNumber: string;
  country: string;
  city: string;
  street: string;
  postCode: string;
  mol: string;
}

interface LineItemForm extends LineItemInput {
  articleId: number | null;
}

function buildSupplierSnapshot(profile: TeamCompanyProfile): PartySnapshot {
  const address = [profile.street, [profile.postCode, profile.city].filter(Boolean).join(' '), profile.country].filter(Boolean).join(', ');
  return {
    legalName: profile.legalName,
    address,
    uic: profile.eik,
    vatNumber: profile.vatNumber ?? null,
  };
}

const emptyRecipient: RecipientForm = {
  name: '',
  eik: '',
  vatNumber: '',
  country: 'BG',
  city: '',
  street: '',
  postCode: '',
  mol: '',
};

const defaultLineItem: LineItemForm = {
  description: '',
  quantity: 1,
  unit: 'бр.',
  unitPrice: 0,
  vatRate: 20,
  discountPercent: 0,
  articleId: null,
};

export default function NewInvoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit') ? Number(searchParams.get('edit')) : null;

  const [companyProfile, setCompanyProfile] = useState<TeamCompanyProfile | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ field: string; message: string }[]>([]);

  // Form state
  const [recipient, setRecipient] = useState<RecipientForm>(emptyRecipient);
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | ''>('');
  const [docType, setDocType] = useState<string>('invoice');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplyDate, setSupplyDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [language, setLanguage] = useState('bg');
  const [currency, setCurrency] = useState('EUR');
  const [fxRate, setFxRate] = useState(1);
  const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...defaultLineItem }]);
  const [vatMode, setVatMode] = useState<'standard' | 'no_vat'>('standard');
  const [noVatReason, setNoVatReason] = useState('');
  const [amountInWordsOverride, setAmountInWordsOverride] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'cash' | 'barter'>('bank');
  const [paymentStatus, setPaymentStatus] = useState('unpaid');
  const [customerNote, setCustomerNote] = useState('');
  const [internalComment, setInternalComment] = useState('');
  const [draftId, setDraftId] = useState<number | null>(editId);

  const isVatRegistered = companyProfile?.isVatRegistered ?? true;
  const defaultVatRate = (companyProfile?.defaultVatRate ?? 20) as BgVatRate;
  const effectiveVatRate = !isVatRegistered || vatMode === 'no_vat' ? 0 : defaultVatRate;

  const recalc = useCallback(() => {
    const itemsWithVat = lineItems.map((item) => ({
      ...item,
      vatRate: effectiveVatRate as BgVatRate,
    }));
    return calculateInvoice(itemsWithVat);
  }, [lineItems, effectiveVatRate]);

  const { totals } = recalc();
  const amountInWords =
    amountInWordsOverride.trim() ||
    amountInWordsBg(totals.totalGross, currency);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [profileRes, partnersRes, articlesRes] = await Promise.all([
      getCompanyProfile(),
      listPartners({ page: 1, pageSize: 500 }),
      listArticles({ page: 1, pageSize: 500 }),
    ]);
    if (profileRes.data) setCompanyProfile(profileRes.data);
    if (partnersRes.data) setPartners(partnersRes.data.items);
    if (articlesRes.data) setArticles(articlesRes.data.items);
    if (editId) {
      const invRes = await getInvoice(editId);
      if (invRes.error || !invRes.data) {
        setError(invRes.error ?? 'Invoice not found');
        setLoading(false);
        return;
      }
      const inv = invRes.data;
      if (inv.status !== 'draft') {
        setError('Only drafts can be edited');
        setLoading(false);
        return;
      }
      setDraftId(inv.id);

      // Load structured recipient from partner FK or fallback to snapshot
      if (inv.partnerId) {
        setSelectedPartnerId(inv.partnerId);
        const partner = partnersRes.data?.items.find((p) => p.id === inv.partnerId);
        if (partner) {
          setRecipient({
            name: partner.name,
            eik: partner.eik,
            vatNumber: partner.vatNumber ?? '',
            country: partner.country,
            city: partner.city,
            street: partner.street,
            postCode: partner.postCode ?? '',
            mol: partner.mol ?? '',
          });
        }
      } else {
        const rec = (inv.recipientSnapshot ?? {}) as PartySnapshot;
        setRecipient({
          name: rec.legalName ?? '',
          eik: rec.uic ?? '',
          vatNumber: rec.vatNumber ?? '',
          country: 'BG',
          city: '',
          street: rec.address ?? '',
          postCode: '',
          mol: '',
        });
      }

      setDocType(inv.docType ?? 'invoice');
      setIssueDate(inv.issueDate ?? issueDate);
      setSupplyDate(inv.supplyDate ?? inv.issueDate ?? supplyDate);
      setLanguage(inv.language ?? 'bg');
      setCurrency(inv.currency ?? 'EUR');
      setFxRate(Number(inv.fxRate ?? 1));

      // Load line items from invoice_lines (with articleId) or fallback to JSONB
      const linesRes = await getInvoiceLines(editId);
      const dbLines = linesRes.data ?? [];
      if (dbLines.length > 0) {
        setLineItems(
          dbLines.map((l) => ({
            description: l.description,
            quantity: Number(l.quantity),
            unit: l.unit,
            unitPrice: Number(l.unitPrice),
            vatRate: (l.vatRate ?? 20) as BgVatRate,
            discountPercent: Number(l.discountPercent ?? 0),
            articleId: l.articleId ?? null,
          }))
        );
      } else {
        const items = (inv.items ?? []) as Array<LineItemInput & { sortOrder?: number }>;
        setLineItems(
          items.length
            ? items.map((i) => ({
                description: i.description,
                quantity: i.quantity,
                unit: i.unit,
                unitPrice: i.unitPrice,
                vatRate: (i.vatRate ?? 20) as BgVatRate,
                discountPercent: i.discountPercent ?? 0,
                articleId: null,
              }))
            : [{ ...defaultLineItem }]
        );
      }

      setVatMode((inv.vatMode as 'standard' | 'no_vat') ?? 'standard');
      setNoVatReason(inv.noVatReason ?? '');
      setAmountInWordsOverride(inv.amountInWords ?? '');
      setPaymentMethod((inv.paymentMethod as 'bank' | 'cash' | 'barter') ?? 'bank');
      setPaymentStatus(inv.paymentStatus ?? 'unpaid');
      setCustomerNote(inv.customerNote ?? '');
      setInternalComment(inv.internalComment ?? '');
    }
    setLoading(false);
  }, [editId]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const handlePartnerSelect = (id: number | '') => {
    setSelectedPartnerId(id);
    if (id === '') {
      setRecipient(emptyRecipient);
      return;
    }
    const p = partners.find((x) => x.id === id);
    if (p) {
      setRecipient({
        name: p.name,
        eik: p.eik,
        vatNumber: p.vatNumber ?? '',
        country: p.country,
        city: p.city,
        street: p.street,
        postCode: p.postCode ?? '',
        mol: p.mol ?? '',
      });
    }
  };

  const handleSaveDraft = async () => {
    if (!companyProfile) {
      setError('Company profile (Supplier) is required. Complete it in Settings.');
      return;
    }
    setSaving(true);
    setError(null);
    setValidationErrors([]);
    const supplier = buildSupplierSnapshot(companyProfile);
    const itemsWithVat: LineItemWithArticle[] = lineItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      vatRate: effectiveVatRate as BgVatRate,
      discountPercent: item.discountPercent,
      articleId: item.articleId,
    }));
    const recipientInput: RecipientInput = {
      partnerId: selectedPartnerId || undefined,
      name: recipient.name,
      eik: recipient.eik,
      vatNumber: recipient.vatNumber || null,
      country: recipient.country || 'BG',
      city: recipient.city,
      street: recipient.street,
      postCode: recipient.postCode || null,
      mol: recipient.mol || null,
    };
    const payload = {
      docType: docType as 'invoice' | 'proforma' | 'credit_note' | 'debit_note',
      issueDate,
      supplyDate: supplyDate || null,
      currency,
      fxRate,
      recipient: recipientInput,
      lineItems: itemsWithVat,
      language,
      paymentMethod,
      paymentStatus,
      vatMode,
      noVatReason: vatMode === 'no_vat' ? noVatReason : null,
      amountInWords: amountInWordsOverride.trim() || amountInWordsBg(totals.totalGross, currency),
      customerNote: customerNote.trim() || null,
      internalComment: internalComment.trim() || null,
    };
    if (draftId) {
      const res = await updateInvoiceDraft(draftId, payload);
      setSaving(false);
      if (res.error) {
        setError(res.error);
        if (res.validationErrors) setValidationErrors(res.validationErrors.map((e) => ({ field: e.field, message: e.message })));
        return;
      }
      if (res.data) setDraftId(res.data.id);
    } else {
      const res = await createInvoiceDraft({ ...payload, supplier });
      setSaving(false);
      if (res.error) {
        setError(res.error);
        if (res.validationErrors) setValidationErrors(res.validationErrors.map((e) => ({ field: e.field, message: e.message })));
        return;
      }
      if (res.data) {
        setDraftId(res.data.id);
        router.replace(`/dashboard/invoices/new?edit=${res.data.id}`);
      }
    }
  };

  const handleFinalize = async () => {
    if (!draftId) {
      setError('Save draft first.');
      return;
    }
    setSaving(true);
    setError(null);
    const res = await finalizeInvoice(draftId);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) router.push(`/dashboard/invoices/${res.data.id}`);
  };

  const handlePreview = () => {
    if (draftId) router.push(`/dashboard/invoices/${draftId}?print=1`);
    else setError('Save draft first to preview.');
  };

  const addLine = () => {
    setLineItems((prev) => [...prev, { ...defaultLineItem, vatRate: effectiveVatRate as BgVatRate }]);
  };

  const updateLine = (index: number, patch: Partial<LineItemForm>) => {
    setLineItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeLine = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <section className="flex-1 p-4 lg:p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/invoices">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg lg:text-2xl font-medium">
          {draftId ? 'Edit draft invoice' : 'New invoice'}
        </h1>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      {validationErrors.length > 0 && (
        <ul className="mb-4 list-disc list-inside text-sm text-red-700">
          {validationErrors.map((e, i) => (
            <li key={i}>{e.field}: {e.message}</li>
          ))}
        </ul>
      )}

      {/* Section A — Recipient */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Получател (Recipient)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Select partner (optional)</Label>
            <select
              className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={selectedPartnerId}
              onChange={(e) => handlePartnerSelect(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">— Manual entry —</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.eik})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="recipientName">Name *</Label>
              <Input
                id="recipientName"
                value={recipient.name}
                onChange={(e) => setRecipient((r) => ({ ...r, name: e.target.value }))}
                placeholder="Legal name"
              />
            </div>
            <div>
              <Label htmlFor="recipientEik">EIK / EGN *</Label>
              <div className="flex gap-2">
                <Input
                  id="recipientEik"
                  value={recipient.eik}
                  onChange={(e) => setRecipient((r) => ({ ...r, eik: e.target.value }))}
                  placeholder="9 or 10 digits"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  title="Fetch by EIK (coming soon)"
                >
                  Fetch by EIK
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="recipientCity">City *</Label>
              <Input
                id="recipientCity"
                value={recipient.city}
                onChange={(e) => setRecipient((r) => ({ ...r, city: e.target.value }))}
                placeholder="City"
              />
            </div>
            <div>
              <Label htmlFor="recipientStreet">Street *</Label>
              <Input
                id="recipientStreet"
                value={recipient.street}
                onChange={(e) => setRecipient((r) => ({ ...r, street: e.target.value }))}
                placeholder="Street address"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="recipientPostCode">Post code</Label>
              <Input
                id="recipientPostCode"
                value={recipient.postCode}
                onChange={(e) => setRecipient((r) => ({ ...r, postCode: e.target.value }))}
                placeholder="1000"
              />
            </div>
            <div>
              <Label htmlFor="recipientCountry">Country</Label>
              <Input
                id="recipientCountry"
                value={recipient.country}
                onChange={(e) => setRecipient((r) => ({ ...r, country: e.target.value }))}
                placeholder="BG"
                maxLength={2}
              />
            </div>
            <div>
              <Label htmlFor="recipientMol">MOL</Label>
              <Input
                id="recipientMol"
                value={recipient.mol}
                onChange={(e) => setRecipient((r) => ({ ...r, mol: e.target.value }))}
                placeholder="Representative"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="recipientVat">VAT number (optional)</Label>
            <Input
              id="recipientVat"
              value={recipient.vatNumber}
              onChange={(e) => setRecipient((r) => ({ ...r, vatNumber: e.target.value }))}
              placeholder="BG123456789"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section B — Document */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Document type</Label>
            <RadioGroup
              value={docType}
              onValueChange={setDocType}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="issueDate">Issue date *</Label>
              <Input
                id="issueDate"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
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
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Language</Label>
              <select
                className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Currency</Label>
              <select
                className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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
                onChange={(e) => setFxRate(Number(e.target.value) || 1)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C — Items */}
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
                onValueChange={(v) => setVatMode(v as 'standard' | 'no_vat')}
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
                  onChange={(e) => setNoVatReason(e.target.value)}
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
                  const itemsWithVat = lineItems.map((item, idx) => ({
                    ...item,
                    vatRate: effectiveVatRate as BgVatRate,
                  }));
                  const calc = calculateInvoice(itemsWithVat);
                  const lineTotal = calc.items[i]?.grossAmount ?? 0;
                  return (
                    <tr key={i} className="border-b">
                      <td className="py-1">
                        <div className="space-y-1">
                          <select
                            className="w-full max-w-[200px] h-8 rounded border px-2 text-sm"
                            value={line.articleId ? String(line.articleId) : ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const art = articles.find((a) => a.id === Number(val));
                              if (art) {
                                updateLine(i, {
                                  articleId: art.id,
                                  description: art.name,
                                  unit: art.unit,
                                  unitPrice: Number(art.defaultUnitPrice),
                                });
                              } else {
                                updateLine(i, { articleId: null });
                              }
                            }}
                          >
                            <option value="">From article...</option>
                            {articles.map((a) => (
                              <option key={a.id} value={String(a.id)}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          <Input
                            className="max-w-[200px]"
                            placeholder="Description *"
                            value={line.description}
                            onChange={(e) => updateLine(i, { description: e.target.value })}
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
                          onChange={(e) => updateLine(i, { quantity: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-1">
                        <Input
                          className="h-8 w-20"
                          value={line.unit}
                          onChange={(e) => updateLine(i, { unit: e.target.value })}
                        />
                      </td>
                      <td className="py-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="h-8 w-24"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) || 0 })}
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
                          onChange={(e) => updateLine(i, { discountPercent: Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="py-1 text-right font-medium">{lineTotal.toFixed(2)}</td>
                      <td className="py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(i)}
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
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            + Add line
          </Button>
        </CardContent>
      </Card>

      {/* Section D — Totals */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Tax base (net)</span>
            <span>{totals.totalNet.toFixed(2)} {currency}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>VAT</span>
            <span>{totals.totalVat.toFixed(2)} {currency}</span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total payable</span>
            <span>{totals.totalGross.toFixed(2)} {currency}</span>
          </div>
          <div>
            <Label>Словом (amount in words) *</Label>
            <Input
              className="mt-1"
              value={amountInWordsOverride || amountInWordsBg(totals.totalGross, currency)}
              onChange={(e) => setAmountInWordsOverride(e.target.value)}
              placeholder="Auto-generated"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section E — Payment */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Method</Label>
            <RadioGroup
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as 'bank' | 'cash' | 'barter')}
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
          {paymentMethod === 'bank' && companyProfile?.iban && (
            <div className="rounded-md bg-gray-50 p-3 text-sm">
              <p className="font-medium">Bank details (from company profile)</p>
              <p>{companyProfile.bankName}</p>
              <p>IBAN: {companyProfile.iban}</p>
              {companyProfile.bicSwift && <p>BIC/SWIFT: {companyProfile.bicSwift}</p>}
            </div>
          )}
          <div>
            <Label>Payment status</Label>
            <select
              className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
            >
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Section F — Notes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="customerNote">Customer-visible note</Label>
            <textarea
              id="customerNote"
              className="mt-1 block w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label htmlFor="internalComment">Internal comment (not on invoice)</Label>
            <textarea
              id="internalComment"
              className="mt-1 block w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={internalComment}
              onChange={(e) => setInternalComment(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={handleSaveDraft} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save draft
        </Button>
        <Button variant="outline" onClick={handlePreview} disabled={saving || !draftId}>
          <FileText className="mr-2 h-4 w-4" />
          Preview
        </Button>
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={handleFinalize}
          disabled={saving || !draftId}
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
          Finalize (issue)
        </Button>
      </div>
    </section>
  );
}

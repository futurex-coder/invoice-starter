/**
 * Runtime parsers for values flowing out of the DB (JSONB columns, string
 * enum columns) into typed application code. Each parser accepts `unknown`
 * and returns the narrowed type, falling back to a safe default on parse
 * failure rather than throwing.
 *
 * Use these at the DB → form-state / DB → render boundary instead of
 * `as Type` casts.
 */

import { z } from 'zod';
import type { Company, Invoice, InvoiceLine } from '@/lib/db/schema';
import {
  DOC_TYPES,
  STATUSES,
  type BgVatRate,
  type DocType,
  type InvoiceStatus,
  type InvoiceTotals,
  type LineItem,
  type LineItemInput,
  type PartySnapshot,
  type VatBreakdownEntry,
} from './types';
import type {
  ParsedCompany,
  ParsedInvoice,
  ParsedInvoiceLine,
} from './parsed-types';

const bgVatRateSchema: z.ZodType<BgVatRate> = z.union([
  z.literal(20),
  z.literal(9),
  z.literal(0),
]);
const docTypeSchema = z.enum(DOC_TYPES);
const invoiceStatusSchema = z.enum(STATUSES);
const vatModeSchema = z.enum(['standard', 'no_vat']);
const paymentMethodSchema = z.enum(['bank', 'cash', 'barter']);
const paymentStatusSchema = z.enum(['unpaid', 'partial', 'paid']);
const accountingStatusSchema = z.enum(['pending', 'accounted']);

const vatBreakdownEntrySchema: z.ZodType<VatBreakdownEntry> = z.object({
  vatRate: z.coerce.number(),
  taxableAmount: z.coerce.number(),
  vatAmount: z.coerce.number(),
});

const invoiceTotalsSchema = z.object({
  netAmount: z.coerce.number(),
  vatAmount: z.coerce.number(),
  grossAmount: z.coerce.number(),
  vatBreakdown: z.array(vatBreakdownEntrySchema).optional(),
});

const lineItemSchema: z.ZodType<LineItem> = z.object({
  description: z.string(),
  quantity: z.coerce.number(),
  unit: z.string(),
  unitPrice: z.coerce.number(),
  vatRate: bgVatRateSchema,
  discountPercent: z.coerce.number().optional(),
  discountAmount: z.coerce.number(),
  netAmount: z.coerce.number(),
  vatAmount: z.coerce.number(),
  grossAmount: z.coerce.number(),
  sortOrder: z.coerce.number(),
});

export type VatMode = z.infer<typeof vatModeSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type AccountingStatus = z.infer<typeof accountingStatusSchema>;

const partySnapshotSchema = z.object({
  legalName: z.string(),
  address: z.string(),
  uic: z.string(),
  vatNumber: z.string().nullable(),
  bankName: z.string().optional(),
  iban: z.string().optional(),
  bic: z.string().optional(),
});

type StoredLineItem = LineItemInput & { sortOrder?: number };
const storedLineItemSchema = z.object({
  description: z.string(),
  quantity: z.coerce.number(),
  unit: z.string(),
  unitPrice: z.coerce.number(),
  vatRate: bgVatRateSchema,
  discountPercent: z.coerce.number().optional(),
  sortOrder: z.number().optional(),
});

export function parseBgVatRate(value: unknown, fallback: BgVatRate = 20): BgVatRate {
  if (value == null) return fallback;
  const numeric = typeof value === 'string' ? Number(value) : value;
  const r = bgVatRateSchema.safeParse(numeric);
  return r.success ? r.data : fallback;
}

export function parseDocType(value: unknown, fallback: DocType = 'invoice'): DocType {
  const r = docTypeSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

export function parseVatMode(value: unknown, fallback: VatMode = 'standard'): VatMode {
  const r = vatModeSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

export function parsePaymentMethod(
  value: unknown,
  fallback: PaymentMethod = 'bank'
): PaymentMethod {
  const r = paymentMethodSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

export function parsePaymentStatus(
  value: unknown,
  fallback: PaymentStatus = 'unpaid'
): PaymentStatus {
  const r = paymentStatusSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

export function parseAccountingStatus(
  value: unknown,
  fallback: AccountingStatus = 'pending'
): AccountingStatus {
  const r = accountingStatusSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

export function parsePartySnapshot(value: unknown): Partial<PartySnapshot> {
  // JSONB snapshots from the DB may be incomplete during early drafts;
  // we return a Partial so callers can fall back per field.
  const r = partySnapshotSchema.partial().safeParse(value ?? {});
  return r.success ? r.data : {};
}

/**
 * Strict variant of {@link parsePartySnapshot} that returns a full
 * `PartySnapshot` with empty defaults for missing fields. Use this at the
 * boundary into the validator / formatter / domain model, which require
 * a complete shape. The validator will catch empty values as their own
 * field-level errors — defaults here are not "silent fallbacks", they're
 * "make TS happy without lying" placeholders.
 */
export function parsePartySnapshotStrict(value: unknown): PartySnapshot {
  const p = parsePartySnapshot(value);
  return {
    legalName: p.legalName ?? '',
    address: p.address ?? '',
    uic: p.uic ?? '',
    vatNumber: p.vatNumber ?? null,
    bankName: p.bankName,
    iban: p.iban,
    bic: p.bic,
  };
}

export function parseInvoiceItems(value: unknown): StoredLineItem[] {
  if (!Array.isArray(value)) return [];
  const out: StoredLineItem[] = [];
  for (const raw of value) {
    const r = storedLineItemSchema.safeParse(raw);
    if (r.success) out.push(r.data);
  }
  return out;
}

/**
 * Parse stored line items as full {@link LineItem}s (with computed fields:
 * discountAmount, netAmount, vatAmount, grossAmount, sortOrder).
 *
 * Items in the DB are always stored post-calculation (`calculateInvoice`
 * runs before insert), so this schema requires the computed fields.
 * Items missing them are dropped.
 */
export function parseStoredLineItems(value: unknown): LineItem[] {
  if (!Array.isArray(value)) return [];
  const out: LineItem[] = [];
  for (const raw of value) {
    const r = lineItemSchema.safeParse(raw);
    if (r.success) out.push(r.data);
  }
  return out;
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return paymentMethodSchema.safeParse(value).success;
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return paymentStatusSchema.safeParse(value).success;
}

export function isDocType(value: unknown): value is DocType {
  return docTypeSchema.safeParse(value).success;
}

export function parseInvoiceStatus(
  value: unknown,
  fallback: InvoiceStatus = 'draft'
): InvoiceStatus {
  const r = invoiceStatusSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

export function parseInvoiceTotals(value: unknown): Partial<InvoiceTotals> {
  const r = invoiceTotalsSchema.partial().safeParse(value ?? {});
  return r.success ? r.data : {};
}

/**
 * Strict variant of {@link parseInvoiceTotals} — returns a full
 * `InvoiceTotals` with zero numeric defaults and an empty `vatBreakdown`
 * array. Use this when feeding totals into the formatter or any consumer
 * that requires the full shape.
 */
export function parseInvoiceTotalsStrict(value: unknown): InvoiceTotals {
  const t = parseInvoiceTotals(value);
  return {
    netAmount: t.netAmount ?? 0,
    vatAmount: t.vatAmount ?? 0,
    grossAmount: t.grossAmount ?? 0,
    vatBreakdown: t.vatBreakdown ?? [],
  };
}

// ---------------------------------------------------------------------------
// Aggregator: full row → ParsedInvoice
// ---------------------------------------------------------------------------

/**
 * Narrow a raw `Invoice` row (Drizzle-inferred type with loose JSONB/enum
 * fields) into a `ParsedInvoice` whose docType/vatMode/etc. are properly
 * typed. Used in server actions so consumers don't have to call individual
 * field parsers.
 */
export function parseInvoiceRow(raw: Invoice): ParsedInvoice {
  return {
    ...raw,
    docType: parseDocType(raw.docType),
    status: parseInvoiceStatus(raw.status),
    vatMode: parseVatMode(raw.vatMode),
    paymentMethod: parsePaymentMethod(raw.paymentMethod),
    paymentStatus: parsePaymentStatus(raw.paymentStatus),
    accountingStatus: parseAccountingStatus(raw.accountingStatus),
    supplierSnapshot: parsePartySnapshot(raw.supplierSnapshot),
    recipientSnapshot: parsePartySnapshot(raw.recipientSnapshot),
    items: parseInvoiceItems(raw.items),
    totals: parseInvoiceTotals(raw.totals),
  };
}

export function parseInvoiceLineRow(raw: InvoiceLine): ParsedInvoiceLine {
  return {
    ...raw,
    vatRate: parseBgVatRate(raw.vatRate),
  };
}

export function parseCompanyRow(raw: Company): ParsedCompany {
  return {
    ...raw,
    defaultPaymentMethod: parsePaymentMethod(raw.defaultPaymentMethod),
  };
}

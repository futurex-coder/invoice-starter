/**
 * Domain types for Bulgarian invoicing.
 *
 * These are pure data shapes used by calculator, validator, and formatter.
 * They mirror the JSONB structures stored in the `invoices` table but
 * are independent of Drizzle / DB concerns.
 */

// ---------------------------------------------------------------------------
// Enums / union types
// ---------------------------------------------------------------------------

export const DOC_TYPES = [
  'invoice',
  'proforma',
  'credit_note',
  'debit_note',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const STATUSES = ['draft', 'issued', 'cancelled'] as const;
export type InvoiceStatus = (typeof STATUSES)[number];

export const BG_VAT_RATES = [20, 9, 0] as const;
export type BgVatRate = (typeof BG_VAT_RATES)[number];

// ---------------------------------------------------------------------------
// Party snapshot (supplier / recipient)
// ---------------------------------------------------------------------------

export interface PartySnapshot {
  legalName: string;
  address: string;
  /** 9-digit BULSTAT / UIC */
  uic: string;
  /** BG VAT number (BG + 9/10 digits), null if not VAT-registered */
  vatNumber: string | null;
}

// ---------------------------------------------------------------------------
// Line item (input — before calculation)
// ---------------------------------------------------------------------------

export interface LineItemInput {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: BgVatRate;
  /** Discount as a percentage (0–100). Optional, defaults to 0. */
  discountPercent?: number;
}

// ---------------------------------------------------------------------------
// Line item (computed — after calculation)
// ---------------------------------------------------------------------------

export interface LineItem extends LineItemInput {
  discountAmount: number;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

export interface InvoiceTotals {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  /** VAT breakdown by rate */
  vatBreakdown: VatBreakdownEntry[];
}

export interface VatBreakdownEntry {
  vatRate: number;
  taxableAmount: number;
  vatAmount: number;
}

// ---------------------------------------------------------------------------
// Full invoice document (domain model, not DB row)
// ---------------------------------------------------------------------------

export interface InvoiceDocument {
  docType: DocType;
  status: InvoiceStatus;
  series: string;
  number: number | null;

  issueDate: string;
  supplyDate: string | null;

  currency: string;
  fxRate: number;

  supplier: PartySnapshot;
  recipient: PartySnapshot;

  items: LineItem[];
  totals: InvoiceTotals;

  /** For credit / debit notes: the original invoice this references */
  referencedInvoiceNumber: string | null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  code: string;
  field: string;
  message: string;
}

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] };

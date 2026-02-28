/**
 * Bulgarian invoicing business rules.
 *
 * References:
 *  - ЗДДС (Bulgarian VAT Act)
 *  - NRA requirements for invoice content
 *  - EUR adoption effective 2026-01-01
 */

import type { DocType, BgVatRate, InvoiceStatus } from './types';

// ---------------------------------------------------------------------------
// VAT
// ---------------------------------------------------------------------------

/** Standard BG VAT rate (%) */
export const BG_STANDARD_VAT_RATE: BgVatRate = 20;

/** Reduced rate for tourism accommodation (9%) */
export const BG_REDUCED_VAT_RATE: BgVatRate = 9;

/** Zero rate for intra-EU / export supplies */
export const BG_ZERO_VAT_RATE: BgVatRate = 0;

/** All recognised VAT rates */
export const VALID_VAT_RATES: readonly BgVatRate[] = [20, 9, 0];

export function isValidVatRate(rate: number): rate is BgVatRate {
  return (VALID_VAT_RATES as readonly number[]).includes(rate);
}

// ---------------------------------------------------------------------------
// UIC / VAT number patterns
// ---------------------------------------------------------------------------

/**
 * BULSTAT / UIC is exactly 9 digits (for legal entities) or 10 digits
 * (for sole traders). We accept both.
 */
export const UIC_PATTERN = /^\d{9,10}$/;

/**
 * Bulgarian VAT number: "BG" prefix + 9 or 10 digits.
 */
export const BG_VAT_NUMBER_PATTERN = /^BG\d{9,10}$/;

export function isValidUic(uic: string): boolean {
  return UIC_PATTERN.test(uic);
}

export function isValidBgVatNumber(vatNumber: string): boolean {
  return BG_VAT_NUMBER_PATTERN.test(vatNumber);
}

// ---------------------------------------------------------------------------
// Invoice numbering
// ---------------------------------------------------------------------------

/**
 * Bulgarian NRA requires consecutive 10-digit invoice numbers.
 * We store as integer; the formatter zero-pads to 10 digits.
 */
export const INVOICE_NUMBER_MIN = 1;
export const INVOICE_NUMBER_MAX = 9_999_999_999;

export function isValidInvoiceNumber(n: number): boolean {
  return Number.isInteger(n) && n >= INVOICE_NUMBER_MIN && n <= INVOICE_NUMBER_MAX;
}

// ---------------------------------------------------------------------------
// Document type rules
// ---------------------------------------------------------------------------

/** Default series prefix per document type */
export const DEFAULT_SERIES: Record<DocType, string> = {
  invoice: 'INV',
  proforma: 'PRF',
  credit_note: 'CN',
  debit_note: 'DN',
};

/** Whether a doc type requires a referenced (original) invoice */
export function requiresReference(docType: DocType): boolean {
  return docType === 'credit_note' || docType === 'debit_note';
}

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['issued', 'cancelled'],
  issued: ['cancelled'],
  cancelled: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * NRA requires invoices to be issued within 5 calendar days of the
 * supply of goods/services or receipt of payment.
 */
export const MAX_ISSUE_DELAY_DAYS = 5;

/**
 * Returns the latest allowable issue date given a supply date.
 */
export function latestIssueDate(supplyDate: string): string {
  const d = new Date(supplyDate);
  d.setDate(d.getDate() + MAX_ISSUE_DELAY_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * Check if issue date is within 5 days of supply date.
 * Returns true if supplyDate is null (issue_date == supply_date assumed).
 */
export function isIssueDateWithinLimit(
  issueDate: string,
  supplyDate: string | null
): boolean {
  if (!supplyDate) return true;
  return issueDate <= latestIssueDate(supplyDate);
}

// ---------------------------------------------------------------------------
// Currency
// ---------------------------------------------------------------------------

/** Bulgaria adopted EUR on 2026-01-01 */
export const DEFAULT_CURRENCY = 'EUR';

/** ISO 4217 3-letter code pattern */
export const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function isValidCurrency(code: string): boolean {
  return CURRENCY_PATTERN.test(code);
}

// ---------------------------------------------------------------------------
// Precision
// ---------------------------------------------------------------------------

/** Monetary amounts: 2 decimal places */
export const MONEY_PRECISION = 2;

/** Quantities / unit prices: up to 4 decimal places */
export const QUANTITY_PRECISION = 4;

/** FX rate: up to 6 decimal places */
export const FX_RATE_PRECISION = 6;

/**
 * Display formatting utilities for Bulgarian invoices.
 *
 * Pure functions — no side effects.
 */

import type { InvoiceDocument, LineItem, PartySnapshot } from './types';
import { MONEY_PRECISION, QUANTITY_PRECISION } from './rules';

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/**
 * Zero-pad an invoice number to 10 digits as required by NRA.
 * Returns empty string for null/undefined.
 */
export function formatInvoiceNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return String(n).padStart(10, '0');
}

/**
 * Format a monetary amount with 2 decimals and optional thousands separator.
 */
export function formatMoney(
  amount: number,
  options?: { thousandsSeparator?: string; decimalSeparator?: string }
): string {
  const sep = options?.thousandsSeparator ?? ' ';
  const dec = options?.decimalSeparator ?? '.';
  const fixed = Math.abs(amount).toFixed(MONEY_PRECISION);
  const [intPart, decPart] = fixed.split('.');
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const sign = amount < 0 ? '-' : '';
  return `${sign}${withSep}${dec}${decPart}`;
}

/**
 * Format a quantity with up to 4 significant decimal places,
 * trimming trailing zeros.
 */
export function formatQuantity(qty: number): string {
  return Number(qty.toFixed(QUANTITY_PRECISION)).toString();
}

/**
 * Format a VAT rate for display: "20%", "9%", "0%".
 */
export function formatVatRate(rate: number): string {
  return `${rate}%`;
}

// ---------------------------------------------------------------------------
// Party formatting
// ---------------------------------------------------------------------------

/**
 * Format party info into multi-line text for invoice rendering.
 */
export function formatParty(party: PartySnapshot): string {
  const lines: string[] = [
    party.legalName,
    party.address,
    `UIC: ${party.uic}`,
  ];
  if (party.vatNumber) {
    lines.push(`VAT: ${party.vatNumber}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Line item table row
// ---------------------------------------------------------------------------

export interface FormattedLineItem {
  sortOrder: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  grossAmount: string;
}

export function formatLineItem(item: LineItem): FormattedLineItem {
  return {
    sortOrder: item.sortOrder + 1,
    description: item.description,
    quantity: formatQuantity(item.quantity),
    unit: item.unit,
    unitPrice: formatMoney(item.unitPrice),
    discountPercent: item.discountPercent ? `${item.discountPercent}%` : '-',
    netAmount: formatMoney(item.netAmount),
    vatRate: formatVatRate(item.vatRate),
    vatAmount: formatMoney(item.vatAmount),
    grossAmount: formatMoney(item.grossAmount),
  };
}

// ---------------------------------------------------------------------------
// Full document header
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Фактура',
  proforma: 'Проформа фактура',
  credit_note: 'Кредитно известие',
  debit_note: 'Дебитно известие',
};

/**
 * Localised label for the document type (Bulgarian).
 */
export function formatDocTypeLabel(docType: string): string {
  return DOC_TYPE_LABELS[docType] ?? docType;
}

/**
 * Format date as DD.MM.YYYY (Bulgarian convention).
 */
export function formatDateBg(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Build a short document title: "Фактура № 0000000001 / 28.02.2026"
 */
export function formatDocumentTitle(doc: InvoiceDocument): string {
  const label = formatDocTypeLabel(doc.docType);
  const num = formatInvoiceNumber(doc.number);
  const dateStr = formatDateBg(doc.issueDate);
  if (num) {
    return `${label} № ${num} / ${dateStr}`;
  }
  return `${label} (чернова) / ${dateStr}`;
}

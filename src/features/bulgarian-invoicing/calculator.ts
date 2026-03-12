/**
 * Pure calculation functions for Bulgarian invoicing.
 *
 * All monetary results are rounded to 2 decimal places (banker's rounding
 * via toFixed). Quantities/unit prices use up to 4 decimals.
 */

import type {
  LineItemInput,
  LineItem,
  InvoiceTotals,
  VatBreakdownEntry,
} from './types';
import { MONEY_PRECISION } from './rules';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Number(n.toFixed(MONEY_PRECISION));
}

// ---------------------------------------------------------------------------
// Line item calculation
// ---------------------------------------------------------------------------

/**
 * Compute a single line item's amounts from its input values.
 */
export function computeLineItem(
  input: LineItemInput,
  sortOrder: number
): LineItem {
  const discountPercent = input.discountPercent ?? 0;
  const lineGross = input.quantity * input.unitPrice;
  const discountAmount = round2(lineGross * (discountPercent / 100));
  const netAmount = round2(lineGross - discountAmount);
  const vatAmount = round2(netAmount * (input.vatRate / 100));
  const grossAmount = round2(netAmount + vatAmount);

  return {
    ...input,
    discountPercent,
    discountAmount,
    netAmount,
    vatAmount,
    grossAmount,
    sortOrder,
  };
}

/**
 * Compute all line items from an array of inputs.
 */
export function computeAllLineItems(inputs: LineItemInput[]): LineItem[] {
  return inputs.map((input, i) => computeLineItem(input, i));
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

/**
 * Build the VAT breakdown: one entry per unique VAT rate.
 */
export function computeVatBreakdown(items: LineItem[]): VatBreakdownEntry[] {
  const map = new Map<number, { taxableAmount: number; vatAmount: number }>();

  for (const item of items) {
    const existing = map.get(item.vatRate);
    if (existing) {
      existing.taxableAmount = round2(existing.taxableAmount + item.netAmount);
      existing.vatAmount = round2(existing.vatAmount + item.vatAmount);
    } else {
      map.set(item.vatRate, {
        taxableAmount: item.netAmount,
        vatAmount: item.vatAmount,
      });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b - a)
    .map(([vatRate, amounts]) => ({ vatRate, ...amounts }));
}

/**
 * Compute invoice totals from computed line items.
 */
export function computeTotals(items: LineItem[]): InvoiceTotals {
  let netAmount = 0;
  let vatAmount = 0;

  for (const item of items) {
    netAmount += item.netAmount;
    vatAmount += item.vatAmount;
  }

  netAmount = round2(netAmount);
  vatAmount = round2(vatAmount);

  return {
    netAmount,
    vatAmount,
    grossAmount: round2(netAmount + vatAmount),
    vatBreakdown: computeVatBreakdown(items),
  };
}

// ---------------------------------------------------------------------------
// Full calculation pipeline
// ---------------------------------------------------------------------------

export interface CalculationResult {
  items: LineItem[];
  totals: InvoiceTotals;
}

/**
 * One-shot: takes raw line item inputs, returns computed items + totals.
 */
export function calculateInvoice(inputs: LineItemInput[]): CalculationResult {
  const items = computeAllLineItems(inputs);
  const totals = computeTotals(items);
  return { items, totals };
}

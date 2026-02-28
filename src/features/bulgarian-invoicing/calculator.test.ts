import { describe, it, expect } from 'vitest';
import {
  computeLineItem,
  computeAllLineItems,
  computeTotals,
  computeVatBreakdown,
  calculateInvoice,
} from './calculator';
import type { LineItemInput } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function item(overrides?: Partial<LineItemInput>): LineItemInput {
  return {
    description: 'Widget',
    quantity: 10,
    unit: 'pcs',
    unitPrice: 100,
    vatRate: 20,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeLineItem
// ---------------------------------------------------------------------------

describe('computeLineItem', () => {
  it('computes net/vat/gross for a simple line', () => {
    const result = computeLineItem(item(), 0);
    expect(result.netAmount).toBe(1000);
    expect(result.vatAmount).toBe(200);
    expect(result.grossAmount).toBe(1200);
    expect(result.discountAmount).toBe(0);
    expect(result.sortOrder).toBe(0);
  });

  it('applies discount correctly', () => {
    const result = computeLineItem(item({ discountPercent: 10 }), 1);
    // 10 * 100 = 1000, discount 10% = 100, net = 900
    expect(result.discountAmount).toBe(100);
    expect(result.netAmount).toBe(900);
    expect(result.vatAmount).toBe(180);
    expect(result.grossAmount).toBe(1080);
    expect(result.sortOrder).toBe(1);
  });

  it('handles zero VAT rate', () => {
    const result = computeLineItem(item({ vatRate: 0 }), 0);
    expect(result.vatAmount).toBe(0);
    expect(result.grossAmount).toBe(1000);
  });

  it('handles reduced 9% rate', () => {
    const result = computeLineItem(item({ vatRate: 9 }), 0);
    expect(result.vatAmount).toBe(90);
    expect(result.grossAmount).toBe(1090);
  });

  it('rounds fractional amounts to 2 decimals', () => {
    const result = computeLineItem(
      item({ quantity: 3, unitPrice: 7.33 }),
      0
    );
    // 3 * 7.33 = 21.99, VAT 20% = 4.398 → 4.40
    expect(result.netAmount).toBe(21.99);
    expect(result.vatAmount).toBe(4.4);
    expect(result.grossAmount).toBe(26.39);
  });

  it('handles 100% discount', () => {
    const result = computeLineItem(item({ discountPercent: 100 }), 0);
    expect(result.netAmount).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.grossAmount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeAllLineItems
// ---------------------------------------------------------------------------

describe('computeAllLineItems', () => {
  it('assigns sequential sortOrder', () => {
    const items = computeAllLineItems([item(), item(), item()]);
    expect(items.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });

  it('returns empty array for empty input', () => {
    expect(computeAllLineItems([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeVatBreakdown
// ---------------------------------------------------------------------------

describe('computeVatBreakdown', () => {
  it('groups by VAT rate descending', () => {
    const items = computeAllLineItems([
      item({ vatRate: 0 }),
      item({ vatRate: 20 }),
      item({ vatRate: 9, unitPrice: 50 }),
    ]);
    const breakdown = computeVatBreakdown(items);
    expect(breakdown).toHaveLength(3);
    expect(breakdown[0].vatRate).toBe(20);
    expect(breakdown[1].vatRate).toBe(9);
    expect(breakdown[2].vatRate).toBe(0);
  });

  it('accumulates amounts for same rate', () => {
    const items = computeAllLineItems([
      item({ quantity: 5, unitPrice: 20 }),
      item({ quantity: 3, unitPrice: 10 }),
    ]);
    const breakdown = computeVatBreakdown(items);
    expect(breakdown).toHaveLength(1);
    expect(breakdown[0].vatRate).toBe(20);
    expect(breakdown[0].taxableAmount).toBe(130); // 100 + 30
    expect(breakdown[0].vatAmount).toBe(26); // 20 + 6
  });
});

// ---------------------------------------------------------------------------
// computeTotals
// ---------------------------------------------------------------------------

describe('computeTotals', () => {
  it('sums all line items', () => {
    const items = computeAllLineItems([item(), item({ vatRate: 9 })]);
    const totals = computeTotals(items);
    expect(totals.totalNet).toBe(2000);
    expect(totals.totalVat).toBe(290); // 200 + 90
    expect(totals.totalGross).toBe(2290);
  });

  it('handles empty items', () => {
    const totals = computeTotals([]);
    expect(totals.totalNet).toBe(0);
    expect(totals.totalVat).toBe(0);
    expect(totals.totalGross).toBe(0);
    expect(totals.vatBreakdown).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// calculateInvoice (integration)
// ---------------------------------------------------------------------------

describe('calculateInvoice', () => {
  it('returns computed items and totals in one call', () => {
    const result = calculateInvoice([
      item(),
      item({ discountPercent: 25, vatRate: 9 }),
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0].sortOrder).toBe(0);
    expect(result.items[1].sortOrder).toBe(1);

    // first line: net 1000, vat 200
    // second line: net 750 (1000 - 250), vat 67.5
    expect(result.totals.totalNet).toBe(1750);
    expect(result.totals.totalVat).toBe(267.5);
    expect(result.totals.totalGross).toBe(2017.5);
  });
});

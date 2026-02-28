import { describe, it, expect } from 'vitest';
import {
  formatInvoiceNumber,
  formatMoney,
  formatQuantity,
  formatVatRate,
  formatParty,
  formatLineItem,
  formatDocTypeLabel,
  formatDateBg,
  formatDocumentTitle,
} from './formatter';
import { calculateInvoice } from './calculator';
import type { InvoiceDocument, PartySnapshot, LineItemInput } from './types';

// ---------------------------------------------------------------------------
// formatInvoiceNumber
// ---------------------------------------------------------------------------

describe('formatInvoiceNumber', () => {
  it('pads to 10 digits', () => {
    expect(formatInvoiceNumber(1)).toBe('0000000001');
    expect(formatInvoiceNumber(123456)).toBe('0000123456');
    expect(formatInvoiceNumber(9999999999)).toBe('9999999999');
  });

  it('returns empty string for null', () => {
    expect(formatInvoiceNumber(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(formatInvoiceNumber(undefined)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatMoney
// ---------------------------------------------------------------------------

describe('formatMoney', () => {
  it('formats with 2 decimals and space thousands', () => {
    expect(formatMoney(1234567.89)).toBe('1 234 567.89');
  });

  it('handles zero', () => {
    expect(formatMoney(0)).toBe('0.00');
  });

  it('handles negative amounts', () => {
    expect(formatMoney(-1500)).toBe('-1 500.00');
  });

  it('supports custom separators', () => {
    expect(
      formatMoney(1234.5, {
        thousandsSeparator: ',',
        decimalSeparator: '.',
      })
    ).toBe('1,234.50');
  });

  it('rounds correctly', () => {
    expect(formatMoney(1.995)).toBe('2.00');
    expect(formatMoney(99.999)).toBe('100.00');
  });
});

// ---------------------------------------------------------------------------
// formatQuantity
// ---------------------------------------------------------------------------

describe('formatQuantity', () => {
  it('trims trailing zeros', () => {
    expect(formatQuantity(10)).toBe('10');
    expect(formatQuantity(1.5)).toBe('1.5');
    expect(formatQuantity(1.2345)).toBe('1.2345');
  });

  it('rounds to 4 decimals', () => {
    expect(formatQuantity(1.23456)).toBe('1.2346');
  });
});

// ---------------------------------------------------------------------------
// formatVatRate
// ---------------------------------------------------------------------------

describe('formatVatRate', () => {
  it('appends %', () => {
    expect(formatVatRate(20)).toBe('20%');
    expect(formatVatRate(9)).toBe('9%');
    expect(formatVatRate(0)).toBe('0%');
  });
});

// ---------------------------------------------------------------------------
// formatParty
// ---------------------------------------------------------------------------

describe('formatParty', () => {
  it('formats all party fields', () => {
    const p: PartySnapshot = {
      legalName: 'Acme EOOD',
      address: 'Sofia, ul. Vitosha 1',
      uic: '123456789',
      vatNumber: 'BG123456789',
    };
    const result = formatParty(p);
    expect(result).toContain('Acme EOOD');
    expect(result).toContain('UIC: 123456789');
    expect(result).toContain('VAT: BG123456789');
  });

  it('omits VAT line when vatNumber is null', () => {
    const p: PartySnapshot = {
      legalName: 'Small Co',
      address: 'Plovdiv',
      uic: '987654321',
      vatNumber: null,
    };
    const result = formatParty(p);
    expect(result).not.toContain('VAT:');
  });
});

// ---------------------------------------------------------------------------
// formatLineItem
// ---------------------------------------------------------------------------

describe('formatLineItem', () => {
  it('formats a computed line item', () => {
    const input: LineItemInput = {
      description: 'Widget',
      quantity: 3,
      unit: 'pcs',
      unitPrice: 50,
      vatRate: 20,
      discountPercent: 10,
    };
    const calc = calculateInvoice([input]);
    const formatted = formatLineItem(calc.items[0]);
    expect(formatted.sortOrder).toBe(1);
    expect(formatted.description).toBe('Widget');
    expect(formatted.quantity).toBe('3');
    expect(formatted.discountPercent).toBe('10%');
    expect(formatted.vatRate).toBe('20%');
  });

  it('shows dash for zero discount', () => {
    const input: LineItemInput = {
      description: 'Service',
      quantity: 1,
      unit: 'hour',
      unitPrice: 100,
      vatRate: 20,
    };
    const calc = calculateInvoice([input]);
    const formatted = formatLineItem(calc.items[0]);
    expect(formatted.discountPercent).toBe('-');
  });
});

// ---------------------------------------------------------------------------
// formatDocTypeLabel
// ---------------------------------------------------------------------------

describe('formatDocTypeLabel', () => {
  it('returns Bulgarian labels', () => {
    expect(formatDocTypeLabel('invoice')).toBe('Фактура');
    expect(formatDocTypeLabel('proforma')).toBe('Проформа фактура');
    expect(formatDocTypeLabel('credit_note')).toBe('Кредитно известие');
    expect(formatDocTypeLabel('debit_note')).toBe('Дебитно известие');
  });

  it('falls back to raw value for unknown type', () => {
    expect(formatDocTypeLabel('other')).toBe('other');
  });
});

// ---------------------------------------------------------------------------
// formatDateBg
// ---------------------------------------------------------------------------

describe('formatDateBg', () => {
  it('converts YYYY-MM-DD to DD.MM.YYYY', () => {
    expect(formatDateBg('2026-02-28')).toBe('28.02.2026');
    expect(formatDateBg('2026-01-05')).toBe('05.01.2026');
  });
});

// ---------------------------------------------------------------------------
// formatDocumentTitle
// ---------------------------------------------------------------------------

describe('formatDocumentTitle', () => {
  it('formats titled document with number', () => {
    const calc = calculateInvoice([
      { description: 'x', quantity: 1, unit: 'pcs', unitPrice: 10, vatRate: 20 },
    ]);
    const doc: InvoiceDocument = {
      docType: 'invoice',
      status: 'issued',
      series: 'INV',
      number: 42,
      issueDate: '2026-02-28',
      supplyDate: null,
      currency: 'EUR',
      fxRate: 1,
      supplier: { legalName: 'S', address: 'A', uic: '123456789', vatNumber: null },
      recipient: { legalName: 'R', address: 'B', uic: '987654321', vatNumber: null },
      items: calc.items,
      totals: calc.totals,
      referencedInvoiceNumber: null,
    };
    expect(formatDocumentTitle(doc)).toBe(
      'Фактура № 0000000042 / 28.02.2026'
    );
  });

  it('shows draft label when no number', () => {
    const calc = calculateInvoice([
      { description: 'x', quantity: 1, unit: 'pcs', unitPrice: 10, vatRate: 20 },
    ]);
    const doc: InvoiceDocument = {
      docType: 'credit_note',
      status: 'draft',
      series: 'CN',
      number: null,
      issueDate: '2026-03-01',
      supplyDate: null,
      currency: 'EUR',
      fxRate: 1,
      supplier: { legalName: 'S', address: 'A', uic: '123456789', vatNumber: null },
      recipient: { legalName: 'R', address: 'B', uic: '987654321', vatNumber: null },
      items: calc.items,
      totals: calc.totals,
      referencedInvoiceNumber: '0000000001',
    };
    expect(formatDocumentTitle(doc)).toBe(
      'Кредитно известие (чернова) / 01.03.2026'
    );
  });
});

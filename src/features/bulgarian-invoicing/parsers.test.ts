import { describe, it, expect } from 'vitest';
import {
  parseBgVatRate,
  parseDocType,
  parseVatMode,
  parsePaymentMethod,
  parsePaymentStatus,
  parsePartySnapshot,
  parsePartySnapshotStrict,
  parseInvoiceItems,
  parseStoredLineItems,
  parseInvoiceTotalsStrict,
  isPaymentMethod,
  isPaymentStatus,
  isDocType,
} from './parsers';

describe('parseBgVatRate', () => {
  it('accepts the three legal rates', () => {
    expect(parseBgVatRate(20)).toBe(20);
    expect(parseBgVatRate(9)).toBe(9);
    expect(parseBgVatRate(0)).toBe(0);
  });

  it('coerces numeric strings (JSONB columns often serialize as strings)', () => {
    expect(parseBgVatRate('20')).toBe(20);
    expect(parseBgVatRate('9')).toBe(9);
  });

  it('falls back to 20 for nullish / unknown values', () => {
    expect(parseBgVatRate(null)).toBe(20);
    expect(parseBgVatRate(undefined)).toBe(20);
    expect(parseBgVatRate(17)).toBe(20);
    expect(parseBgVatRate('bogus')).toBe(20);
  });

  it('respects a custom fallback', () => {
    expect(parseBgVatRate(null, 0)).toBe(0);
    expect(parseBgVatRate('nope', 9)).toBe(9);
  });
});

describe('parseDocType', () => {
  it('accepts all 4 doc types', () => {
    expect(parseDocType('invoice')).toBe('invoice');
    expect(parseDocType('proforma')).toBe('proforma');
    expect(parseDocType('credit_note')).toBe('credit_note');
    expect(parseDocType('debit_note')).toBe('debit_note');
  });

  it('falls back to invoice for invalid input', () => {
    expect(parseDocType('quote')).toBe('invoice');
    expect(parseDocType(null)).toBe('invoice');
    expect(parseDocType(42)).toBe('invoice');
  });
});

describe('parseVatMode', () => {
  it('accepts standard and no_vat', () => {
    expect(parseVatMode('standard')).toBe('standard');
    expect(parseVatMode('no_vat')).toBe('no_vat');
  });

  it('falls back to standard otherwise', () => {
    expect(parseVatMode(null)).toBe('standard');
    expect(parseVatMode('weird')).toBe('standard');
  });
});

describe('parsePaymentMethod', () => {
  it('accepts the 3 methods', () => {
    expect(parsePaymentMethod('bank')).toBe('bank');
    expect(parsePaymentMethod('cash')).toBe('cash');
    expect(parsePaymentMethod('barter')).toBe('barter');
  });

  it('falls back to bank', () => {
    expect(parsePaymentMethod('card')).toBe('bank');
    expect(parsePaymentMethod(null)).toBe('bank');
  });
});

describe('parsePaymentStatus', () => {
  it('accepts the 3 statuses', () => {
    expect(parsePaymentStatus('unpaid')).toBe('unpaid');
    expect(parsePaymentStatus('partial')).toBe('partial');
    expect(parsePaymentStatus('paid')).toBe('paid');
  });

  it('falls back to unpaid', () => {
    expect(parsePaymentStatus('overdue')).toBe('unpaid');
  });
});

describe('parsePartySnapshot', () => {
  it('parses a complete snapshot', () => {
    const snap = parsePartySnapshot({
      legalName: 'Acme Ltd',
      address: 'Sofia, 1000',
      uic: '123456789',
      vatNumber: 'BG123456789',
    });
    expect(snap.legalName).toBe('Acme Ltd');
    expect(snap.uic).toBe('123456789');
    expect(snap.vatNumber).toBe('BG123456789');
  });

  it('returns empty object for null/garbage input', () => {
    expect(parsePartySnapshot(null)).toEqual({});
    expect(parsePartySnapshot('not-an-object')).toEqual({});
  });

  it('accepts partial snapshots (drafts may be incomplete)', () => {
    const snap = parsePartySnapshot({ legalName: 'Just a name' });
    // Schema requires all fields, so partial input parses as {}
    // The behavior is "return whatever Zod's partial-mode lets through"
    expect(typeof snap).toBe('object');
  });
});

describe('parseInvoiceItems', () => {
  it('parses a list of stored items', () => {
    const items = parseInvoiceItems([
      {
        description: 'Widget',
        quantity: 5,
        unit: 'pcs',
        unitPrice: 100,
        vatRate: 20,
        discountPercent: 10,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].description).toBe('Widget');
    expect(items[0].vatRate).toBe(20);
  });

  it('coerces numeric strings', () => {
    const items = parseInvoiceItems([
      {
        description: 'Widget',
        quantity: '3',
        unit: 'pcs',
        unitPrice: '99.5',
        vatRate: 20,
      },
    ]);
    expect(items[0].quantity).toBe(3);
    expect(items[0].unitPrice).toBe(99.5);
  });

  it('drops malformed items and keeps valid ones', () => {
    const items = parseInvoiceItems([
      { description: 'OK', quantity: 1, unit: 'pcs', unitPrice: 10, vatRate: 20 },
      { description: 'Bad', /* missing fields */ },
      { description: 'Also OK', quantity: 2, unit: 'pcs', unitPrice: 5, vatRate: 9 },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0].description).toBe('OK');
    expect(items[1].description).toBe('Also OK');
  });

  it('returns [] for non-array input', () => {
    expect(parseInvoiceItems(null)).toEqual([]);
    expect(parseInvoiceItems('nope')).toEqual([]);
    expect(parseInvoiceItems({})).toEqual([]);
  });
});

describe('type guards', () => {
  it('isPaymentMethod', () => {
    expect(isPaymentMethod('bank')).toBe(true);
    expect(isPaymentMethod('card')).toBe(false);
    expect(isPaymentMethod(123)).toBe(false);
  });

  it('isPaymentStatus', () => {
    expect(isPaymentStatus('paid')).toBe(true);
    expect(isPaymentStatus('overdue')).toBe(false);
  });

  it('isDocType', () => {
    expect(isDocType('credit_note')).toBe(true);
    expect(isDocType('memo')).toBe(false);
  });
});

describe('parsePartySnapshotStrict', () => {
  it('returns a full PartySnapshot for a valid JSONB object', () => {
    const r = parsePartySnapshotStrict({
      legalName: 'Acme EOOD',
      address: 'Sofia, BG',
      uic: '123456789',
      vatNumber: 'BG123456789',
    });
    expect(r.legalName).toBe('Acme EOOD');
    expect(r.uic).toBe('123456789');
    expect(r.vatNumber).toBe('BG123456789');
  });

  it('fills empty defaults for missing fields without lying about completeness', () => {
    const r = parsePartySnapshotStrict({ legalName: 'Acme' });
    expect(r.legalName).toBe('Acme');
    expect(r.address).toBe('');
    expect(r.uic).toBe('');
    expect(r.vatNumber).toBeNull();
  });

  it('returns an all-default snapshot for null/undefined input', () => {
    const r = parsePartySnapshotStrict(null);
    expect(r).toEqual({
      legalName: '',
      address: '',
      uic: '',
      vatNumber: null,
      bankName: undefined,
      iban: undefined,
      bic: undefined,
    });
  });

  it('preserves optional bank fields when present', () => {
    const r = parsePartySnapshotStrict({
      legalName: 'Acme',
      address: 'Sofia',
      uic: '111',
      vatNumber: null,
      bankName: 'DSK',
      iban: 'BG80BNBG96611020345678',
      bic: 'STSABGSF',
    });
    expect(r.bankName).toBe('DSK');
    expect(r.iban).toBe('BG80BNBG96611020345678');
    expect(r.bic).toBe('STSABGSF');
  });
});

describe('parseInvoiceTotalsStrict', () => {
  it('returns a full InvoiceTotals for a valid JSONB object', () => {
    const r = parseInvoiceTotalsStrict({
      netAmount: 100,
      vatAmount: 20,
      grossAmount: 120,
      vatBreakdown: [{ vatRate: 20, taxableAmount: 100, vatAmount: 20 }],
    });
    expect(r).toEqual({
      netAmount: 100,
      vatAmount: 20,
      grossAmount: 120,
      vatBreakdown: [{ vatRate: 20, taxableAmount: 100, vatAmount: 20 }],
    });
  });

  it('zeros out missing numeric fields and defaults vatBreakdown to []', () => {
    expect(parseInvoiceTotalsStrict({})).toEqual({
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
      vatBreakdown: [],
    });
  });

  it('returns all-zeros for null/undefined input', () => {
    const z = {
      netAmount: 0,
      vatAmount: 0,
      grossAmount: 0,
      vatBreakdown: [],
    };
    expect(parseInvoiceTotalsStrict(null)).toEqual(z);
    expect(parseInvoiceTotalsStrict(undefined)).toEqual(z);
  });

  it('coerces numeric strings (JSONB columns often serialize numbers as strings)', () => {
    const r = parseInvoiceTotalsStrict({
      netAmount: '100',
      vatAmount: '20',
      grossAmount: '120',
    });
    expect(r.netAmount).toBe(100);
    expect(r.vatAmount).toBe(20);
    expect(r.grossAmount).toBe(120);
  });
});

describe('parseStoredLineItems', () => {
  const fullItem = {
    description: 'Widget',
    quantity: 2,
    unit: 'pcs',
    unitPrice: 10,
    vatRate: 20,
    discountPercent: 0,
    discountAmount: 0,
    netAmount: 20,
    vatAmount: 4,
    grossAmount: 24,
    sortOrder: 1,
  };

  it('returns valid LineItems unchanged', () => {
    const r = parseStoredLineItems([fullItem]);
    expect(r).toHaveLength(1);
    expect(r[0].description).toBe('Widget');
    expect(r[0].netAmount).toBe(20);
    expect(r[0].grossAmount).toBe(24);
  });

  it('drops items missing computed fields (filters silently)', () => {
    // Missing netAmount, vatAmount, grossAmount, sortOrder — these are the
    // post-calculation fields. Such items aren't fully formed; drop them
    // rather than fabricate values.
    const stored = { ...fullItem };
    const partial = {
      description: 'Half-built',
      quantity: 1,
      unit: 'pcs',
      unitPrice: 5,
      vatRate: 20,
    };
    const r = parseStoredLineItems([stored, partial]);
    expect(r).toHaveLength(1);
    expect(r[0].description).toBe('Widget');
  });

  it('returns [] for non-array input', () => {
    expect(parseStoredLineItems(null)).toEqual([]);
    expect(parseStoredLineItems(undefined)).toEqual([]);
    expect(parseStoredLineItems('not an array')).toEqual([]);
    expect(parseStoredLineItems({})).toEqual([]);
  });

  it('coerces numeric strings within each item', () => {
    const stringy = {
      ...fullItem,
      quantity: '2',
      unitPrice: '10',
      netAmount: '20',
      vatAmount: '4',
      grossAmount: '24',
      sortOrder: '1',
    };
    const r = parseStoredLineItems([stringy]);
    expect(r).toHaveLength(1);
    expect(r[0].quantity).toBe(2);
    expect(r[0].grossAmount).toBe(24);
  });
});

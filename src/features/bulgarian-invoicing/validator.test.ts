import { describe, it, expect } from 'vitest';
import { validateInvoice } from './validator';
import { calculateInvoice } from './calculator';
import type { InvoiceDocument, LineItemInput, PartySnapshot } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function party(overrides?: Partial<PartySnapshot>): PartySnapshot {
  return {
    legalName: 'Acme EOOD',
    address: 'Sofia, ul. Test 1',
    uic: '123456789',
    vatNumber: 'BG123456789',
    ...overrides,
  };
}

function lineInput(overrides?: Partial<LineItemInput>): LineItemInput {
  return {
    description: 'Consulting',
    quantity: 1,
    unit: 'hour',
    unitPrice: 100,
    vatRate: 20,
    ...overrides,
  };
}

function validDoc(overrides?: Partial<InvoiceDocument>): InvoiceDocument {
  const calc = calculateInvoice([lineInput()]);
  return {
    docType: 'invoice',
    status: 'draft',
    series: 'INV',
    number: null,
    issueDate: '2026-02-28',
    supplyDate: null,
    currency: 'EUR',
    fxRate: 1,
    supplier: party(),
    recipient: party({ legalName: 'Client OOD', uic: '987654321', vatNumber: 'BG987654321' }),
    items: calc.items,
    totals: calc.totals,
    referencedInvoiceNumber: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid documents
// ---------------------------------------------------------------------------

describe('validateInvoice — valid cases', () => {
  it('accepts a valid draft invoice', () => {
    const result = validateInvoice(validDoc());
    expect(result.valid).toBe(true);
  });

  it('accepts a valid issued invoice with a number', () => {
    const result = validateInvoice(
      validDoc({ status: 'issued', number: 1 })
    );
    expect(result.valid).toBe(true);
  });

  it('accepts a credit note with reference', () => {
    const result = validateInvoice(
      validDoc({
        docType: 'credit_note',
        referencedInvoiceNumber: '0000000001',
      })
    );
    expect(result.valid).toBe(true);
  });

  it('accepts a party without VAT number (not VAT-registered)', () => {
    const result = validateInvoice(
      validDoc({
        supplier: party({ vatNumber: null }),
      })
    );
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DocType / Status
// ---------------------------------------------------------------------------

describe('validateInvoice — docType and status', () => {
  it('rejects invalid docType', () => {
    const result = validateInvoice(
      validDoc({ docType: 'receipt' as InvoiceDocument['docType'] })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'INVALID_DOC_TYPE')).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    const result = validateInvoice(
      validDoc({ status: 'pending' as InvoiceDocument['status'] })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'INVALID_STATUS')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Number
// ---------------------------------------------------------------------------

describe('validateInvoice — number', () => {
  it('requires number when status is issued', () => {
    const result = validateInvoice(validDoc({ status: 'issued', number: null }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'number' && e.code === 'REQUIRED')).toBe(true);
    }
  });

  it('rejects invalid number (0)', () => {
    const result = validateInvoice(validDoc({ status: 'issued', number: 0 }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'INVALID_NUMBER')).toBe(true);
    }
  });

  it('allows null number for drafts', () => {
    const result = validateInvoice(validDoc({ status: 'draft', number: null }));
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Currency / FX
// ---------------------------------------------------------------------------

describe('validateInvoice — currency and fxRate', () => {
  it('rejects invalid currency code', () => {
    const result = validateInvoice(validDoc({ currency: 'eu' }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'INVALID_CURRENCY')).toBe(true);
    }
  });

  it('rejects zero fxRate', () => {
    const result = validateInvoice(validDoc({ fxRate: 0 }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'INVALID_FX_RATE')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Parties
// ---------------------------------------------------------------------------

describe('validateInvoice — parties', () => {
  it('requires supplier', () => {
    const result = validateInvoice(
      validDoc({ supplier: null as unknown as PartySnapshot })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'supplier')).toBe(true);
    }
  });

  it('rejects invalid UIC', () => {
    const result = validateInvoice(
      validDoc({ supplier: party({ uic: '123' }) })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'INVALID_UIC')).toBe(true);
    }
  });

  it('rejects invalid VAT number format', () => {
    const result = validateInvoice(
      validDoc({ supplier: party({ vatNumber: '123456789' }) })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'INVALID_VAT_NUMBER')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

describe('validateInvoice — items', () => {
  it('requires at least one item', () => {
    const doc = validDoc();
    doc.items = [];
    doc.totals = { netAmount: 0, vatAmount: 0, grossAmount: 0, vatBreakdown: [] };
    const result = validateInvoice(doc);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.field === 'items' && e.code === 'REQUIRED')).toBe(true);
    }
  });

  it('rejects negative quantity', () => {
    const calc = calculateInvoice([lineInput({ quantity: -1 })]);
    const result = validateInvoice(validDoc({ items: calc.items, totals: calc.totals }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'INVALID_QUANTITY')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

describe('validateInvoice — dates', () => {
  it('rejects malformed issue date', () => {
    const result = validateInvoice(validDoc({ issueDate: '28-02-2026' }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'INVALID_DATE')).toBe(true);
    }
  });

  it('rejects issue date > 5 days after supply date when issued', () => {
    const result = validateInvoice(
      validDoc({
        status: 'issued',
        number: 1,
        issueDate: '2026-03-10',
        supplyDate: '2026-02-28',
      })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'ISSUE_DATE_TOO_LATE')).toBe(true);
    }
  });

  it('allows issue date within 5 days of supply date', () => {
    const result = validateInvoice(
      validDoc({
        status: 'issued',
        number: 1,
        issueDate: '2026-03-03',
        supplyDate: '2026-02-28',
      })
    );
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Reference requirement
// ---------------------------------------------------------------------------

describe('validateInvoice — reference', () => {
  it('requires reference for credit_note', () => {
    const result = validateInvoice(
      validDoc({ docType: 'credit_note', referencedInvoiceNumber: null })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'REFERENCE_REQUIRED')).toBe(true);
    }
  });

  it('requires reference for debit_note', () => {
    const result = validateInvoice(
      validDoc({ docType: 'debit_note', referencedInvoiceNumber: null })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'REFERENCE_REQUIRED')).toBe(true);
    }
  });

  it('does not require reference for invoice', () => {
    const result = validateInvoice(
      validDoc({ docType: 'invoice', referencedInvoiceNumber: null })
    );
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Totals cross-check
// ---------------------------------------------------------------------------

describe('validateInvoice — totals cross-check', () => {
  it('rejects mismatched netAmount', () => {
    const calc = calculateInvoice([lineInput()]);
    const result = validateInvoice(
      validDoc({
        items: calc.items,
        totals: { ...calc.totals, netAmount: 999 },
      })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.code === 'TOTALS_MISMATCH')).toBe(true);
    }
  });
});

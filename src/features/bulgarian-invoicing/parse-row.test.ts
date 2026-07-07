import { describe, it, expect } from 'vitest';
import {
  parseCompanyRow,
  parseInvoiceLineRow,
  parseInvoiceRow,
} from './parsers';
import type { Company, Invoice, InvoiceLine } from '@/lib/db/schema';

function fixtureInvoice(overrides?: Partial<Invoice>): Invoice {
  const base: Invoice = {
    id: 1,
    companyId: 1,
    createdByUserId: null,
    referencedInvoiceId: null,
    partnerId: null,
    docType: 'invoice',
    status: 'draft',
    series: 'INV',
    number: 1,
    issueDate: '2026-01-01',
    supplyDate: null,
    currency: 'EUR',
    fxRate: '1',
    supplierSnapshot: null,
    recipientSnapshot: null,
    items: null,
    totals: null,
    language: 'bg',
    paymentMethod: 'bank',
    paymentStatus: 'unpaid',
    accountingStatus: 'pending',
    dueDate: null,
    vatMode: 'standard',
    noVatReason: null,
    amountInWords: null,
    customerNote: null,
    internalComment: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides };
}

function fixtureInvoiceLine(overrides?: Partial<InvoiceLine>): InvoiceLine {
  const base: InvoiceLine = {
    id: 1,
    invoiceId: 1,
    articleId: null,
    sortOrder: 0,
    description: 'Widget',
    quantity: '5',
    unit: 'pcs',
    unitPrice: '100',
    vatRate: 20,
    discountPercent: '0',
    discountAmount: '0',
    netAmount: '500',
    vatAmount: '100',
    grossAmount: '600',
    createdAt: new Date(),
  };
  return { ...base, ...overrides };
}

describe('parseInvoiceRow', () => {
  it('narrows enum fields', () => {
    const parsed = parseInvoiceRow(
      fixtureInvoice({
        docType: 'proforma',
        status: 'finalized',
        vatMode: 'no_vat',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
      })
    );
    expect(parsed.docType).toBe('proforma');
    expect(parsed.status).toBe('finalized');
    expect(parsed.vatMode).toBe('no_vat');
    expect(parsed.paymentMethod).toBe('cash');
    expect(parsed.paymentStatus).toBe('paid');
  });

  it('falls back on bogus enum values rather than throwing', () => {
    const parsed = parseInvoiceRow(
      fixtureInvoice({
        docType: 'memo',
        vatMode: 'weird',
        paymentMethod: 'crypto',
      })
    );
    expect(parsed.docType).toBe('invoice');
    expect(parsed.vatMode).toBe('standard');
    expect(parsed.paymentMethod).toBe('bank');
  });

  it('parses JSONB items array', () => {
    const parsed = parseInvoiceRow(
      fixtureInvoice({
        items: [
          {
            description: 'Item A',
            quantity: 1,
            unit: 'pcs',
            unitPrice: 10,
            vatRate: 20,
          },
        ],
      })
    );
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].description).toBe('Item A');
  });

  it('returns [] for missing JSONB items', () => {
    const parsed = parseInvoiceRow(fixtureInvoice({ items: null }));
    expect(parsed.items).toEqual([]);
  });

  it('parses recipientSnapshot to partial', () => {
    const parsed = parseInvoiceRow(
      fixtureInvoice({
        recipientSnapshot: {
          legalName: 'Acme',
          address: 'Sofia',
          uic: '111111111',
          vatNumber: null,
        },
      })
    );
    expect(parsed.recipientSnapshot.legalName).toBe('Acme');
  });

  it('passes scalar fields through untouched', () => {
    const created = new Date('2026-01-15T00:00:00Z');
    const parsed = parseInvoiceRow(
      fixtureInvoice({ number: 42, currency: 'BGN', createdAt: created })
    );
    expect(parsed.number).toBe(42);
    expect(parsed.currency).toBe('BGN');
    expect(parsed.createdAt).toBe(created);
  });
});

describe('parseInvoiceLineRow', () => {
  it('narrows vatRate from number column', () => {
    const parsed = parseInvoiceLineRow(fixtureInvoiceLine({ vatRate: 9 }));
    expect(parsed.vatRate).toBe(9);
  });

  it('falls back on illegal vat rates', () => {
    const parsed = parseInvoiceLineRow(fixtureInvoiceLine({ vatRate: 17 }));
    expect(parsed.vatRate).toBe(20);
  });
});

describe('parseCompanyRow', () => {
  function fixtureCompany(overrides?: Partial<Company>): Company {
    const base: Company = {
      id: 1,
      legalName: 'Acme Ltd',
      eik: '123456789',
      vatNumber: null,
      isVatRegistered: true,
      country: 'BG',
      city: 'Sofia',
      street: 'Vitosha 1',
      postCode: null,
      mol: null,
      bankName: null,
      iban: null,
      bicSwift: null,
      defaultCurrency: 'EUR',
      defaultVatRate: 20,
      defaultPaymentMethod: 'bank',
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return { ...base, ...overrides };
  }

  it('narrows defaultPaymentMethod', () => {
    const parsed = parseCompanyRow(fixtureCompany({ defaultPaymentMethod: 'cash' }));
    expect(parsed.defaultPaymentMethod).toBe('cash');
  });

  it('falls back to bank on unknown method', () => {
    const parsed = parseCompanyRow(fixtureCompany({ defaultPaymentMethod: 'crypto' }));
    expect(parsed.defaultPaymentMethod).toBe('bank');
  });
});

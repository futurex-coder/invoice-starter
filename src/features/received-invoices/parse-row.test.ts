import { describe, it, expect } from 'vitest';
import {
  parseReceivedInvoiceLineRow,
  parseReceivedInvoiceRow,
} from './parsers';
import type { ReceivedInvoice, ReceivedInvoiceLine } from '@/lib/db/schema';

function fixtureRow(overrides?: Partial<ReceivedInvoice>): ReceivedInvoice {
  const base: ReceivedInvoice = {
    id: 1,
    companyId: 1,
    uploadedByUserId: null,
    status: 'draft',
    fileBucket: 'received-invoices',
    fileObjectKey: 'path/to/file.pdf',
    fileMimeType: 'application/pdf',
    fileSizeBytes: 1234,
    fileOriginalName: 'invoice.pdf',
    fileChecksumSha256: null,
    rawExtraction: {},
    extractionConfidence: null,
    extractionModelId: null,
    extractedAt: new Date(),
    partnerId: null,
    supplierSnapshot: null,
    invoiceNumber: null,
    issueDate: null,
    supplyDate: null,
    dueDate: null,
    currency: 'EUR',
    fxRate: '1',
    netAmount: '0',
    vatAmount: '0',
    grossAmount: '0',
    paymentMethod: 'bank',
    paymentStatus: 'unpaid',
    accountingStatus: 'pending',
    notes: null,
    archivedAt: null,
    confirmedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides };
}

function fixtureLine(overrides?: Partial<ReceivedInvoiceLine>): ReceivedInvoiceLine {
  const base: ReceivedInvoiceLine = {
    id: 1,
    receivedInvoiceId: 1,
    sortOrder: 0,
    description: 'Service',
    quantity: '1',
    unit: 'pcs',
    unitPrice: '100',
    vatRate: 20,
    discountPercent: '0',
    netAmount: '100',
    vatAmount: '20',
    grossAmount: '120',
    createdAt: new Date(),
  };
  return { ...base, ...overrides };
}

describe('parseReceivedInvoiceRow', () => {
  it('narrows enum fields', () => {
    const parsed = parseReceivedInvoiceRow(
      fixtureRow({
        status: 'confirmed',
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        accountingStatus: 'accounted',
      })
    );
    expect(parsed.status).toBe('confirmed');
    expect(parsed.paymentMethod).toBe('cash');
    expect(parsed.paymentStatus).toBe('paid');
    expect(parsed.accountingStatus).toBe('accounted');
  });

  it('falls back on bogus enum values', () => {
    const parsed = parseReceivedInvoiceRow(
      fixtureRow({
        status: 'frozen',
        paymentMethod: 'crypto',
        paymentStatus: 'overdue',
        accountingStatus: 'booked',
      })
    );
    expect(parsed.status).toBe('draft');
    expect(parsed.paymentMethod).toBe('bank');
    expect(parsed.paymentStatus).toBe('unpaid');
    expect(parsed.accountingStatus).toBe('pending');
  });

  it('parses supplierSnapshot JSONB', () => {
    const parsed = parseReceivedInvoiceRow(
      fixtureRow({
        supplierSnapshot: {
          legalName: 'Vendor Inc',
          eik: '999999999',
          vatNumber: 'BG999999999',
        },
      })
    );
    expect(parsed.supplierSnapshot.legalName).toBe('Vendor Inc');
    expect(parsed.supplierSnapshot.eik).toBe('999999999');
  });

  it('returns null-filled supplierSnapshot for null JSONB', () => {
    const parsed = parseReceivedInvoiceRow(fixtureRow({ supplierSnapshot: null }));
    expect(parsed.supplierSnapshot.legalName).toBeNull();
    expect(parsed.supplierSnapshot.eik).toBeNull();
  });
});

describe('parseReceivedInvoiceLineRow', () => {
  it('narrows vatRate', () => {
    const parsed = parseReceivedInvoiceLineRow(fixtureLine({ vatRate: 0 }));
    expect(parsed.vatRate).toBe(0);
  });

  it('falls back on illegal vat rates', () => {
    const parsed = parseReceivedInvoiceLineRow(fixtureLine({ vatRate: 13 }));
    expect(parsed.vatRate).toBe(20);
  });
});

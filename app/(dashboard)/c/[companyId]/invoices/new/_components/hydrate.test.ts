import { describe, it, expect } from 'vitest';
import type { Partner } from '@/lib/db/schema';
import type { ParsedInvoice } from '@/src/features/bulgarian-invoicing/parsed-types';
import { invoiceToFormState, invoiceToCopyFormState } from './hydrate';

const TODAY = new Date().toISOString().slice(0, 10);

function fixturePartner(): Partner {
  return {
    id: 42,
    companyId: 1,
    name: 'Acme Ltd',
    eik: '123456789',
    vatNumber: 'BG123456789',
    isIndividual: false,
    country: 'BG',
    city: 'Sofia',
    street: 'Vitosha 1',
    postCode: '1000',
    mol: 'Иван Иванов',
    linkedCompanyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function fixtureInvoice(overrides?: Partial<ParsedInvoice>): ParsedInvoice {
  const base: ParsedInvoice = {
    id: 11,
    companyId: 1,
    createdByUserId: 1,
    referencedInvoiceId: null,
    partnerId: 42,
    docType: 'invoice',
    status: 'finalized',
    series: 'INV',
    number: 7,
    issueDate: '2026-01-11',
    supplyDate: '2026-01-10',
    currency: 'BGN',
    fxRate: '1.95583',
    supplierSnapshot: { legalName: 'Алфа Консулт ООД', uic: '123456789' },
    recipientSnapshot: { legalName: 'Acme Ltd', uic: '123456789' },
    items: [
      {
        description: 'Консултация',
        quantity: 2,
        unit: 'бр.',
        unitPrice: 100,
        vatRate: 20,
        discountPercent: 0,
      },
    ],
    totals: { netAmount: 200, vatAmount: 40, grossAmount: 240 },
    language: 'bg',
    paymentMethod: 'bank',
    paymentStatus: 'paid',
    dueDate: '2026-02-01',
    vatMode: 'standard',
    noVatReason: null,
    amountInWords: 'двеста и четиридесет лева',
    customerNote: 'к бележка',
    internalComment: 'вътрешен коментар',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides };
}

describe('invoiceToCopyFormState (OI-2 Copy)', () => {
  it('clones partner, lines, currency, payment method and VAT mode from the source', () => {
    const state = invoiceToCopyFormState(fixtureInvoice(), [], [fixturePartner()]);

    expect(state.selectedPartnerId).toBe(42);
    expect(state.recipient.name).toBe('Acme Ltd');
    expect(state.lineItems).toHaveLength(1);
    expect(state.lineItems[0]).toMatchObject({
      description: 'Консултация',
      quantity: 2,
      unitPrice: 100,
      vatRate: 20,
    });
    expect(state.currency).toBe('BGN');
    expect(state.fxRate).toBeCloseTo(1.95583);
    expect(state.paymentMethod).toBe('bank');
    expect(state.vatMode).toBe('standard');
    expect(state.language).toBe('bg');
  });

  it('starts a fresh document: today, unpaid, no notes, plain invoice', () => {
    const state = invoiceToCopyFormState(fixtureInvoice(), [], [fixturePartner()]);

    expect(state.issueDate).toBe(TODAY);
    expect(state.supplyDate).toBe(TODAY);
    expect(state.dueDate).toBe('');
    expect(state.paymentStatus).toBe('unpaid');
    expect(state.customerNote).toBe('');
    expect(state.internalComment).toBe('');
    expect(state.amountInWordsOverride).toBe('');
  });

  it('always produces docType invoice, even when copying a credit note', () => {
    const cn = fixtureInvoice({ docType: 'credit_note', referencedInvoiceId: 3 });
    const state = invoiceToCopyFormState(cn, [], [fixturePartner()]);
    expect(state.docType).toBe('invoice');
  });

  it('differs from edit hydration exactly on the fresh-document fields', () => {
    const inv = fixtureInvoice();
    const edit = invoiceToFormState(inv, [], [fixturePartner()]);
    const copy = invoiceToCopyFormState(inv, [], [fixturePartner()]);

    // edit keeps the source's dates/status/notes
    expect(edit.issueDate).toBe('2026-01-11');
    expect(edit.paymentStatus).toBe('paid');
    expect(edit.customerNote).toBe('к бележка');

    // everything not deliberately reset matches the edit hydration
    expect({ ...copy }).toEqual({
      ...edit,
      docType: 'invoice',
      issueDate: TODAY,
      supplyDate: TODAY,
      dueDate: '',
      paymentStatus: 'unpaid',
      customerNote: '',
      internalComment: '',
    });
  });
});

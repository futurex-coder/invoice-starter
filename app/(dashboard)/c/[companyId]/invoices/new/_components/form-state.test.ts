import { describe, it, expect } from 'vitest';
import {
  formReducer,
  makeInitialFormState,
  type FormState,
} from './form-state';
import { defaultLineItem, emptyRecipient } from './types';
import type { Partner } from '@/lib/db/schema';

function fixturePartner(overrides?: Partial<Partner>): Partner {
  const base: Partner = {
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
  return { ...base, ...overrides };
}

describe('formReducer', () => {
  const initial: FormState = makeInitialFormState();

  it('SET applies a partial patch', () => {
    const next = formReducer(initial, {
      type: 'SET',
      patch: { docType: 'proforma', currency: 'BGN' },
    });
    expect(next.docType).toBe('proforma');
    expect(next.currency).toBe('BGN');
    // Untouched fields remain identical.
    expect(next.recipient).toBe(initial.recipient);
    expect(next.lineItems).toBe(initial.lineItems);
  });

  it('SET_RECIPIENT merges into the recipient object', () => {
    const next = formReducer(initial, {
      type: 'SET_RECIPIENT',
      patch: { name: 'Beta', vatNumber: 'BG999' },
    });
    expect(next.recipient.name).toBe('Beta');
    expect(next.recipient.vatNumber).toBe('BG999');
    // Existing recipient fields preserved (empty in initial).
    expect(next.recipient.country).toBe(initial.recipient.country);
  });

  it('SELECT_PARTNER with null resets to empty recipient', () => {
    const withPartner: FormState = {
      ...initial,
      selectedPartnerId: 1,
      recipient: { ...initial.recipient, name: 'Stale' },
    };
    const next = formReducer(withPartner, { type: 'SELECT_PARTNER', partner: null });
    expect(next.selectedPartnerId).toBe('');
    expect(next.recipient).toEqual(emptyRecipient);
  });

  it('SELECT_PARTNER copies the partner data into the recipient', () => {
    const partner = fixturePartner();
    const next = formReducer(initial, { type: 'SELECT_PARTNER', partner });
    expect(next.selectedPartnerId).toBe(42);
    expect(next.recipient).toEqual({
      name: 'Acme Ltd',
      eik: '123456789',
      vatNumber: 'BG123456789',
      country: 'BG',
      city: 'Sofia',
      street: 'Vitosha 1',
      postCode: '1000',
      mol: 'Иван Иванов',
    });
  });

  it('SELECT_PARTNER handles nullable partner fields', () => {
    const partner = fixturePartner({ vatNumber: null, postCode: null, mol: null });
    const next = formReducer(initial, { type: 'SELECT_PARTNER', partner });
    expect(next.recipient.vatNumber).toBe('');
    expect(next.recipient.postCode).toBe('');
    expect(next.recipient.mol).toBe('');
  });

  it('ADD_LINE appends with the requested vatRate', () => {
    const next = formReducer(initial, { type: 'ADD_LINE', vatRate: 9 });
    expect(next.lineItems).toHaveLength(initial.lineItems.length + 1);
    expect(next.lineItems[next.lineItems.length - 1]).toEqual({
      ...defaultLineItem,
      vatRate: 9,
    });
  });

  it('UPDATE_LINE patches the indexed item only', () => {
    const withTwo: FormState = {
      ...initial,
      lineItems: [
        { ...defaultLineItem, description: 'A' },
        { ...defaultLineItem, description: 'B' },
      ],
    };
    const next = formReducer(withTwo, {
      type: 'UPDATE_LINE',
      index: 1,
      patch: { quantity: 5, description: 'B-edited' },
    });
    expect(next.lineItems[0].description).toBe('A');
    expect(next.lineItems[1].description).toBe('B-edited');
    expect(next.lineItems[1].quantity).toBe(5);
  });

  it('REMOVE_LINE removes the indexed item', () => {
    const withTwo: FormState = {
      ...initial,
      lineItems: [
        { ...defaultLineItem, description: 'A' },
        { ...defaultLineItem, description: 'B' },
      ],
    };
    const next = formReducer(withTwo, { type: 'REMOVE_LINE', index: 0 });
    expect(next.lineItems).toHaveLength(1);
    expect(next.lineItems[0].description).toBe('B');
  });

  it('REMOVE_LINE refuses to drop the last item', () => {
    const next = formReducer(initial, { type: 'REMOVE_LINE', index: 0 });
    expect(next).toBe(initial); // identity — no state change
  });

  it('HYDRATE replaces the whole state', () => {
    const replacement: FormState = {
      ...initial,
      docType: 'credit_note',
      currency: 'BGN',
    };
    const next = formReducer(initial, { type: 'HYDRATE', state: replacement });
    expect(next).toBe(replacement);
  });
});

import { describe, it, expect } from 'vitest';
import {
  settingsFormReducer,
  profileToFormState,
  initialSettingsForm,
  type SettingsFormState,
} from './form-state';
import type { ParsedCompany } from '@/src/features/bulgarian-invoicing/parsed-types';

function fixtureCompany(overrides?: Partial<ParsedCompany>): ParsedCompany {
  const base: ParsedCompany = {
    id: 1,
    legalName: 'Acme Ltd',
    eik: '123456789',
    vatNumber: 'BG123456789',
    isVatRegistered: true,
    country: 'BG',
    city: 'Sofia',
    street: 'Vitosha 1',
    postCode: '1000',
    mol: 'Иван',
    bankName: 'UniCredit',
    iban: 'BG80BNBG96611020345678',
    bicSwift: 'UNCRBGSF',
    defaultCurrency: 'EUR',
    defaultVatRate: 20,
    defaultPaymentMethod: 'bank',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return { ...base, ...overrides };
}

describe('settingsFormReducer', () => {
  it('SET merges a partial patch', () => {
    const next = settingsFormReducer(initialSettingsForm, {
      type: 'SET',
      patch: { legalName: 'New name', defaultCurrency: 'BGN' },
    });
    expect(next.legalName).toBe('New name');
    expect(next.defaultCurrency).toBe('BGN');
    expect(next.eik).toBe(initialSettingsForm.eik);
  });

  it('HYDRATE replaces the entire state', () => {
    const replacement: SettingsFormState = {
      ...initialSettingsForm,
      legalName: 'X',
      city: 'Y',
    };
    const next = settingsFormReducer(initialSettingsForm, {
      type: 'HYDRATE',
      state: replacement,
    });
    expect(next).toBe(replacement);
  });
});

describe('profileToFormState', () => {
  it('maps every field from the parsed row', () => {
    const out = profileToFormState(fixtureCompany());
    expect(out.legalName).toBe('Acme Ltd');
    expect(out.eik).toBe('123456789');
    expect(out.vatNumber).toBe('BG123456789');
    expect(out.isVatRegistered).toBe(true);
    expect(out.defaultPaymentMethod).toBe('bank');
    expect(out.defaultCurrency).toBe('EUR');
    expect(out.defaultVatRate).toBe(20);
  });

  it('converts nullable strings to empty strings (form-friendly)', () => {
    const out = profileToFormState(
      fixtureCompany({
        vatNumber: null,
        mol: null,
        bankName: null,
        iban: null,
        bicSwift: null,
        postCode: null,
      })
    );
    expect(out.vatNumber).toBe('');
    expect(out.mol).toBe('');
    expect(out.bankName).toBe('');
    expect(out.iban).toBe('');
    expect(out.bicSwift).toBe('');
    expect(out.postCode).toBe('');
  });

  // Note: payment-method narrowing used to happen inside profileToFormState
  // via parsePaymentMethod. Since the parser pushdown landed, narrowing is
  // done in the server action's parseCompanyRow(), and profileToFormState
  // receives an already-narrowed ParsedCompany. The narrowing logic itself
  // is covered by src/features/bulgarian-invoicing/parsers.test.ts.
});

import type { ParsedCompany } from '@/src/features/bulgarian-invoicing/parsed-types';
import type { PaymentMethod } from './types';

export interface SettingsFormState {
  legalName: string;
  eik: string;
  vatNumber: string;
  isVatRegistered: boolean;
  country: string;
  city: string;
  street: string;
  postCode: string;
  mol: string;
  bankName: string;
  iban: string;
  bicSwift: string;
  defaultCurrency: string;
  defaultVatRate: number;
  defaultPaymentMethod: PaymentMethod;
}

export const initialSettingsForm: SettingsFormState = {
  legalName: '',
  eik: '',
  vatNumber: '',
  isVatRegistered: true,
  country: 'BG',
  city: '',
  street: '',
  postCode: '',
  mol: '',
  bankName: '',
  iban: '',
  bicSwift: '',
  defaultCurrency: 'EUR',
  defaultVatRate: 20,
  defaultPaymentMethod: 'bank',
};

export function profileToFormState(p: ParsedCompany): SettingsFormState {
  return {
    legalName: p.legalName,
    eik: p.eik,
    vatNumber: p.vatNumber ?? '',
    isVatRegistered: p.isVatRegistered,
    country: p.country,
    city: p.city,
    street: p.street,
    postCode: p.postCode ?? '',
    mol: p.mol ?? '',
    bankName: p.bankName ?? '',
    iban: p.iban ?? '',
    bicSwift: p.bicSwift ?? '',
    defaultCurrency: p.defaultCurrency,
    defaultVatRate: p.defaultVatRate,
    defaultPaymentMethod: p.defaultPaymentMethod,
  };
}

export type SettingsFormAction =
  | { type: 'SET'; patch: Partial<SettingsFormState> }
  | { type: 'HYDRATE'; state: SettingsFormState };

export function settingsFormReducer(
  state: SettingsFormState,
  action: SettingsFormAction
): SettingsFormState {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.patch };
    case 'HYDRATE':
      return action.state;
  }
}

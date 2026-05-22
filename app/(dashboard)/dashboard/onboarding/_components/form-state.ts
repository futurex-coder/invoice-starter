import type { ParsedCompany } from '@/src/features/bulgarian-invoicing/parsed-types';
import type { PaymentMethod } from './types';

export interface OnboardingFormState {
  legalName: string;
  eik: string;
  isVatRegistered: boolean;
  vatNumber: string;
  mol: string;
  street: string;
  city: string;
  postCode: string;
  country: string;
  bankName: string;
  iban: string;
  bicSwift: string;
  defaultPaymentMethod: PaymentMethod;
  defaultCurrency: string;
  defaultVatRate: number;
}

export const initialOnboardingForm: OnboardingFormState = {
  legalName: '',
  eik: '',
  isVatRegistered: true,
  vatNumber: '',
  mol: '',
  street: '',
  city: '',
  postCode: '1000',
  country: 'BG',
  bankName: '',
  iban: '',
  bicSwift: '',
  defaultPaymentMethod: 'bank',
  defaultCurrency: 'EUR',
  defaultVatRate: 20,
};

export function profileToOnboardingForm(p: ParsedCompany): OnboardingFormState {
  return {
    legalName: p.legalName,
    eik: p.eik,
    isVatRegistered: p.isVatRegistered,
    vatNumber: p.vatNumber ?? '',
    mol: p.mol ?? '',
    street: p.street,
    city: p.city,
    postCode: p.postCode ?? '1000',
    country: p.country,
    bankName: p.bankName ?? '',
    iban: p.iban ?? '',
    bicSwift: p.bicSwift ?? '',
    defaultPaymentMethod: p.defaultPaymentMethod,
    defaultCurrency: p.defaultCurrency,
    defaultVatRate: p.defaultVatRate,
  };
}

export type OnboardingFormAction =
  | { type: 'SET'; patch: Partial<OnboardingFormState> }
  | { type: 'HYDRATE'; state: OnboardingFormState };

export function onboardingFormReducer(
  state: OnboardingFormState,
  action: OnboardingFormAction
): OnboardingFormState {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.patch };
    case 'HYDRATE':
      return action.state;
  }
}

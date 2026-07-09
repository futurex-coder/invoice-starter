export const CURRENCIES = ['EUR', 'BGN', 'USD'] as const;

export const PAYMENT_METHODS = [
  { value: 'bank', label: 'Банков път' },
  { value: 'cash', label: 'В брой' },
  { value: 'card', label: 'Карта' },
] as const;

export type EikStatus = 'idle' | 'checking' | 'available' | 'taken';

export interface CreateCompanyFormState {
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
  defaultPaymentMethod: string;
}

export const initialCreateCompanyForm: CreateCompanyFormState = {
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

export type CreateCompanyAction =
  | { type: 'SET'; patch: Partial<CreateCompanyFormState> };

export function createCompanyFormReducer(
  state: CreateCompanyFormState,
  action: CreateCompanyAction
): CreateCompanyFormState {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.patch };
  }
}

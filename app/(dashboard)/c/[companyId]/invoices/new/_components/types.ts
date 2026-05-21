import type { LineItemInput } from '@/src/features/bulgarian-invoicing/types';

export interface RecipientForm {
  name: string;
  eik: string;
  vatNumber: string;
  country: string;
  city: string;
  street: string;
  postCode: string;
  mol: string;
}

export interface LineItemForm extends LineItemInput {
  articleId: number | null;
}

export type VatMode = 'standard' | 'no_vat';
export type PaymentMethod = 'bank' | 'cash' | 'barter';

export const emptyRecipient: RecipientForm = {
  name: '',
  eik: '',
  vatNumber: '',
  country: 'BG',
  city: '',
  street: '',
  postCode: '',
  mol: '',
};

export const defaultLineItem: LineItemForm = {
  description: '',
  quantity: 1,
  unit: 'бр.',
  unitPrice: 0,
  vatRate: 20,
  discountPercent: 0,
  articleId: null,
};

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['bank', 'cash', 'barter'] as const;
export const LANGUAGES = [
  { value: 'bg', label: 'Български' },
  { value: 'en', label: 'English' },
] as const;
export const CURRENCIES = ['BGN', 'EUR'] as const;

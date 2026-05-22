import type { Partner } from '@/lib/db/schema';
import type { BgVatRate, DocType } from '@/src/features/bulgarian-invoicing/types';
import {
  emptyRecipient,
  defaultLineItem,
  type RecipientForm,
  type LineItemForm,
  type VatMode,
  type PaymentMethod,
} from './types';

export interface FormState {
  recipient: RecipientForm;
  selectedPartnerId: number | '';
  docType: DocType;
  issueDate: string;
  supplyDate: string;
  language: string;
  currency: string;
  fxRate: number;
  lineItems: LineItemForm[];
  vatMode: VatMode;
  noVatReason: string;
  amountInWordsOverride: string;
  paymentMethod: PaymentMethod;
  paymentStatus: string;
  dueDate: string;
  customerNote: string;
  internalComment: string;
}

export function makeInitialFormState(): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    recipient: emptyRecipient,
    selectedPartnerId: '',
    docType: 'invoice',
    issueDate: today,
    supplyDate: today,
    language: 'bg',
    currency: 'EUR',
    fxRate: 1,
    lineItems: [{ ...defaultLineItem }],
    vatMode: 'standard',
    noVatReason: '',
    amountInWordsOverride: '',
    paymentMethod: 'bank',
    paymentStatus: 'unpaid',
    dueDate: '',
    customerNote: '',
    internalComment: '',
  };
}

export type FormAction =
  | { type: 'SET'; patch: Partial<FormState> }
  | { type: 'SET_RECIPIENT'; patch: Partial<RecipientForm> }
  | { type: 'SELECT_PARTNER'; partner: Partner | null }
  | { type: 'ADD_LINE'; vatRate: BgVatRate }
  | { type: 'UPDATE_LINE'; index: number; patch: Partial<LineItemForm> }
  | { type: 'REMOVE_LINE'; index: number }
  | { type: 'HYDRATE'; state: FormState };

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.patch };
    case 'SET_RECIPIENT':
      return { ...state, recipient: { ...state.recipient, ...action.patch } };
    case 'SELECT_PARTNER': {
      if (!action.partner) {
        return { ...state, selectedPartnerId: '', recipient: emptyRecipient };
      }
      const p = action.partner;
      return {
        ...state,
        selectedPartnerId: p.id,
        recipient: {
          name: p.name,
          eik: p.eik,
          vatNumber: p.vatNumber ?? '',
          country: p.country,
          city: p.city,
          street: p.street,
          postCode: p.postCode ?? '',
          mol: p.mol ?? '',
        },
      };
    }
    case 'ADD_LINE':
      return {
        ...state,
        lineItems: [...state.lineItems, { ...defaultLineItem, vatRate: action.vatRate }],
      };
    case 'UPDATE_LINE': {
      const lines = state.lineItems.map((line, i) =>
        i === action.index ? { ...line, ...action.patch } : line
      );
      return { ...state, lineItems: lines };
    }
    case 'REMOVE_LINE':
      if (state.lineItems.length <= 1) return state;
      return {
        ...state,
        lineItems: state.lineItems.filter((_, i) => i !== action.index),
      };
    case 'HYDRATE':
      return action.state;
  }
}

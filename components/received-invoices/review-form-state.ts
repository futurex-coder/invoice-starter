import type {
  AccountingStatus,
  PaymentMethod,
  PaymentStatus,
  ReceivedInvoiceLineInput,
  ReceivedInvoiceReviewInput,
  SupplierSnapshot,
} from '@/src/features/received-invoices/types';

export const blankLine: ReceivedInvoiceLineInput = {
  description: '',
  quantity: 1,
  unit: 'бр.',
  unitPrice: 0,
  vatRate: 20,
  discountPercent: 0,
};

export interface FormState {
  partnerId: number | null;
  supplier: SupplierSnapshot;
  createPartnerOnConfirm: boolean;
  invoiceNumber: string;
  issueDate: string;
  supplyDate: string;
  dueDate: string;
  currency: string;
  fxRate: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  accountingStatus: AccountingStatus;
  lineItems: ReceivedInvoiceLineInput[];
  notes: string;
}

export function makeInitialFormState(
  initial: ReceivedInvoiceReviewInput
): FormState {
  return {
    partnerId: initial.partnerId ?? null,
    supplier: initial.supplier,
    createPartnerOnConfirm: initial.createPartnerOnConfirm,
    invoiceNumber: initial.invoiceNumber ?? '',
    issueDate: initial.issueDate ?? '',
    supplyDate: initial.supplyDate ?? '',
    dueDate: initial.dueDate ?? '',
    currency: initial.currency,
    fxRate: initial.fxRate,
    paymentMethod: initial.paymentMethod,
    paymentStatus: initial.paymentStatus,
    accountingStatus: initial.accountingStatus,
    lineItems:
      initial.lineItems.length > 0 ? initial.lineItems : [{ ...blankLine }],
    notes: initial.notes ?? '',
  };
}

export type FormAction =
  | { type: 'SET'; patch: Partial<FormState> }
  | { type: 'SET_SUPPLIER'; patch: Partial<SupplierSnapshot> }
  | { type: 'LINK_PARTNER'; partnerId: number }
  | { type: 'UNLINK_PARTNER' }
  | { type: 'ADD_LINE' }
  | {
      type: 'UPDATE_LINE';
      index: number;
      patch: Partial<ReceivedInvoiceLineInput>;
    }
  | { type: 'REMOVE_LINE'; index: number };

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET':
      return { ...state, ...action.patch };
    case 'SET_SUPPLIER':
      return { ...state, supplier: { ...state.supplier, ...action.patch } };
    case 'LINK_PARTNER':
      return {
        ...state,
        partnerId: action.partnerId,
        createPartnerOnConfirm: false,
      };
    case 'UNLINK_PARTNER':
      return { ...state, partnerId: null, createPartnerOnConfirm: true };
    case 'ADD_LINE':
      return { ...state, lineItems: [...state.lineItems, { ...blankLine }] };
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
  }
}

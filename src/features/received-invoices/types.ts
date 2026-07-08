import type { ExtractedInvoice } from '@/app/api/invoices/extract/schema';

export const RECEIVED_INVOICE_STATUSES = [
  'analyzing',
  'failed',
  'draft',
  'confirmed',
  'discarded',
] as const;
export type ReceivedInvoiceLifecycleStatus =
  (typeof RECEIVED_INVOICE_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ACCOUNTING_STATUSES = ['pending', 'accounted'] as const;
export type AccountingStatus = (typeof ACCOUNTING_STATUSES)[number];

export const PAYMENT_METHODS = ['bank', 'cash', 'barter'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface SupplierSnapshot {
  legalName: string | null;
  eik: string | null;
  vatNumber: string | null;
  country?: string | null;
  city?: string | null;
  street?: string | null;
  postCode?: string | null;
}

export interface ReceivedInvoiceLineInput {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: 0 | 9 | 20;
  discountPercent: number;
}

export interface ReceivedInvoiceReviewInput {
  partnerId?: number | null;
  supplier: SupplierSnapshot;
  createPartnerOnConfirm: boolean;

  invoiceNumber: string | null;
  issueDate: string | null;
  supplyDate: string | null;
  dueDate: string | null;

  currency: string;
  fxRate: number;

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  accountingStatus: AccountingStatus;

  lineItems: ReceivedInvoiceLineInput[];

  notes: string | null;
}

export interface DuplicateMatch {
  id: number;
  invoiceNumber: string | null;
  issueDate: string | null;
  matchType: 'checksum' | 'fields';
}

export interface UploadDraftResult {
  id: number;
  duplicates: DuplicateMatch[];
}

export type RawExtraction = ExtractedInvoice;

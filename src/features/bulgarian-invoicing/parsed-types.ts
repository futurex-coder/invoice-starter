/**
 * Narrowed "post-parse" views of the Drizzle-inferred Invoice/InvoiceLine
 * rows. Server actions return these instead of raw `Invoice` so consumers
 * receive properly-typed JSONB and enum fields without running parsers
 * themselves.
 *
 * The actions that produce these types call the per-field parsers in
 * `./parsers` and the aggregator helpers in `./parse-invoice`.
 */

import type { Company, Invoice, InvoiceLine } from '@/lib/db/schema';
import type {
  BgVatRate,
  DocType,
  InvoiceStatus,
  InvoiceTotals,
  LineItemInput,
  PartySnapshot,
} from './types';
import type {
  AccountingStatus,
  PaymentMethod,
  PaymentStatus,
  VatMode,
} from './parsers';

export type StoredLineItem = LineItemInput & { sortOrder?: number };

export type ParsedInvoice = Omit<
  Invoice,
  | 'docType'
  | 'status'
  | 'vatMode'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'accountingStatus'
  | 'supplierSnapshot'
  | 'recipientSnapshot'
  | 'items'
  | 'totals'
> & {
  docType: DocType;
  status: InvoiceStatus;
  vatMode: VatMode;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  accountingStatus: AccountingStatus;
  supplierSnapshot: Partial<PartySnapshot>;
  recipientSnapshot: Partial<PartySnapshot>;
  items: StoredLineItem[];
  totals: Partial<InvoiceTotals>;
};

export type ParsedInvoiceLine = Omit<InvoiceLine, 'vatRate'> & {
  vatRate: BgVatRate;
};

export type ParsedCompany = Omit<Company, 'defaultPaymentMethod'> & {
  defaultPaymentMethod: PaymentMethod;
};

/**
 * Narrowed "post-parse" views of the Drizzle-inferred ReceivedInvoice /
 * ReceivedInvoiceLine rows. See bulgarian-invoicing/parsed-types.ts for the
 * same pattern.
 */

import type { ReceivedInvoice, ReceivedInvoiceLine } from '@/lib/db/schema';
import type { BgVatRate } from '@/src/features/bulgarian-invoicing/types';
import type {
  AccountingStatus,
  PaymentMethod,
  PaymentStatus,
  ReceivedInvoiceLifecycleStatus,
  SupplierSnapshot,
} from './types';

export type ParsedReceivedInvoice = Omit<
  ReceivedInvoice,
  | 'status'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'accountingStatus'
  | 'supplierSnapshot'
> & {
  status: ReceivedInvoiceLifecycleStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  accountingStatus: AccountingStatus;
  supplierSnapshot: SupplierSnapshot;
};

export type ParsedReceivedInvoiceLine = Omit<ReceivedInvoiceLine, 'vatRate'> & {
  vatRate: BgVatRate;
};

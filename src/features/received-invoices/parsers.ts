/**
 * Runtime parsers for received-invoice JSONB / enum columns.
 * See bulgarian-invoicing/parsers.ts for the same pattern.
 */

import { z } from 'zod';
import type {
  ReceivedInvoice,
  ReceivedInvoiceLine,
} from '@/lib/db/schema';
import { parseBgVatRate } from '@/src/features/bulgarian-invoicing/parsers';
import {
  ACCOUNTING_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  RECEIVED_INVOICE_STATUSES,
  type AccountingStatus,
  type PaymentMethod,
  type PaymentStatus,
  type ReceivedInvoiceLifecycleStatus,
  type SupplierSnapshot,
} from './types';
import type {
  ParsedReceivedInvoice,
  ParsedReceivedInvoiceLine,
} from './parsed-types';

const accountingStatusSchema = z.enum(ACCOUNTING_STATUSES);
const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
const paymentMethodSchema = z.enum(PAYMENT_METHODS);
const lifecycleStatusSchema = z.enum(RECEIVED_INVOICE_STATUSES);

const supplierSnapshotSchema = z.object({
  legalName: z.string().nullable(),
  eik: z.string().nullable(),
  vatNumber: z.string().nullable(),
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  postCode: z.string().nullable().optional(),
});

export function parseAccountingStatus(
  value: unknown,
  fallback: AccountingStatus = 'pending'
): AccountingStatus {
  const r = accountingStatusSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

export function parsePaymentStatus(
  value: unknown,
  fallback: PaymentStatus = 'unpaid'
): PaymentStatus {
  const r = paymentStatusSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

export function parsePaymentMethod(
  value: unknown,
  fallback: PaymentMethod = 'bank'
): PaymentMethod {
  const r = paymentMethodSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

export function parseSupplierSnapshot(value: unknown): SupplierSnapshot {
  const r = supplierSnapshotSchema.safeParse(value ?? {});
  if (r.success) return r.data;
  return {
    legalName: null,
    eik: null,
    vatNumber: null,
  };
}

export function isAccountingStatus(value: unknown): value is AccountingStatus {
  return accountingStatusSchema.safeParse(value).success;
}

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return paymentStatusSchema.safeParse(value).success;
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return paymentMethodSchema.safeParse(value).success;
}

export function parseLifecycleStatus(
  value: unknown,
  fallback: ReceivedInvoiceLifecycleStatus = 'draft'
): ReceivedInvoiceLifecycleStatus {
  const r = lifecycleStatusSchema.safeParse(value);
  return r.success ? r.data : fallback;
}

// ---------------------------------------------------------------------------
// Aggregator: full row → ParsedReceivedInvoice
// ---------------------------------------------------------------------------

export function parseReceivedInvoiceRow(
  raw: ReceivedInvoice
): ParsedReceivedInvoice {
  return {
    ...raw,
    status: parseLifecycleStatus(raw.status),
    paymentMethod: parsePaymentMethod(raw.paymentMethod),
    paymentStatus: parsePaymentStatus(raw.paymentStatus),
    accountingStatus: parseAccountingStatus(raw.accountingStatus),
    supplierSnapshot: parseSupplierSnapshot(raw.supplierSnapshot),
  };
}

export function parseReceivedInvoiceLineRow(
  raw: ReceivedInvoiceLine
): ParsedReceivedInvoiceLine {
  return {
    ...raw,
    vatRate: parseBgVatRate(raw.vatRate),
  };
}

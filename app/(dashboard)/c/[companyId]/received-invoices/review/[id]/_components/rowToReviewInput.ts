import type { ReceivedInvoice, ReceivedInvoiceLine } from '@/lib/db/schema';
import type { ReceivedInvoiceReviewInput } from '@/src/features/received-invoices/types';
import {
  parseAccountingStatus,
  parsePaymentMethod,
  parsePaymentStatus,
  parseSupplierSnapshot,
} from '@/src/features/received-invoices/parsers';
import { parseBgVatRate } from '@/src/features/bulgarian-invoicing/parsers';

export function rowToReviewInput(
  row: ReceivedInvoice,
  lines: ReceivedInvoiceLine[]
): ReceivedInvoiceReviewInput {
  return {
    partnerId: row.partnerId,
    supplier: parseSupplierSnapshot(row.supplierSnapshot),
    createPartnerOnConfirm: !row.partnerId,
    invoiceNumber: row.invoiceNumber,
    issueDate: row.issueDate,
    supplyDate: row.supplyDate,
    dueDate: row.dueDate,
    currency: row.currency,
    fxRate: Number(row.fxRate),
    paymentMethod: parsePaymentMethod(row.paymentMethod),
    paymentStatus: parsePaymentStatus(row.paymentStatus),
    accountingStatus: parseAccountingStatus(row.accountingStatus),
    lineItems: lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitPrice: Number(l.unitPrice),
      vatRate: parseBgVatRate(l.vatRate),
      discountPercent: Number(l.discountPercent),
    })),
    notes: row.notes,
  };
}

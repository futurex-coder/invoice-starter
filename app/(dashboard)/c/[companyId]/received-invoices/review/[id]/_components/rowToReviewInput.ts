import type {
  ParsedReceivedInvoice,
  ParsedReceivedInvoiceLine,
} from '@/src/features/received-invoices/parsed-types';
import type { ReceivedInvoiceReviewInput } from '@/src/features/received-invoices/types';

export function rowToReviewInput(
  row: ParsedReceivedInvoice,
  lines: ParsedReceivedInvoiceLine[]
): ReceivedInvoiceReviewInput {
  return {
    partnerId: row.partnerId,
    supplier: row.supplierSnapshot,
    createPartnerOnConfirm: !row.partnerId,
    invoiceNumber: row.invoiceNumber,
    issueDate: row.issueDate,
    supplyDate: row.supplyDate,
    dueDate: row.dueDate,
    currency: row.currency,
    fxRate: Number(row.fxRate),
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    accountingStatus: row.accountingStatus,
    lineItems: lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitPrice: Number(l.unitPrice),
      vatRate: l.vatRate,
      discountPercent: Number(l.discountPercent),
    })),
    notes: row.notes,
  };
}

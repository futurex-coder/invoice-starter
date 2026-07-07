import type { Partner } from '@/lib/db/schema';
import type {
  ParsedInvoice,
  ParsedInvoiceLine,
} from '@/src/features/bulgarian-invoicing/parsed-types';
import {
  emptyRecipient,
  defaultLineItem,
  type LineItemForm,
  type RecipientForm,
} from './types';
import type { FormState } from './form-state';

function recipientFromInvoice(
  inv: ParsedInvoice,
  partners: Partner[]
): {
  recipient: RecipientForm;
  selectedPartnerId: number | '';
} {
  if (inv.partnerId) {
    const partner = partners.find((p) => p.id === inv.partnerId);
    if (partner) {
      return {
        selectedPartnerId: inv.partnerId,
        recipient: {
          name: partner.name,
          eik: partner.eik ?? '',
          vatNumber: partner.vatNumber ?? '',
          country: partner.country,
          city: partner.city,
          street: partner.street,
          postCode: partner.postCode ?? '',
          mol: partner.mol ?? '',
        },
      };
    }
    return { selectedPartnerId: inv.partnerId, recipient: emptyRecipient };
  }
  const snap = inv.recipientSnapshot;
  return {
    selectedPartnerId: '',
    recipient: {
      name: snap.legalName ?? '',
      eik: snap.uic ?? '',
      vatNumber: snap.vatNumber ?? '',
      country: 'BG',
      city: '',
      street: snap.address ?? '',
      postCode: '',
      mol: '',
    },
  };
}

function lineItemsFromInvoice(
  inv: ParsedInvoice,
  dbLines: ParsedInvoiceLine[]
): LineItemForm[] {
  if (dbLines.length > 0) {
    return dbLines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unit: l.unit,
      unitPrice: Number(l.unitPrice),
      vatRate: l.vatRate,
      discountPercent: Number(l.discountPercent ?? 0),
      articleId: l.articleId ?? null,
    }));
  }
  if (inv.items.length > 0) {
    return inv.items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate,
      discountPercent: i.discountPercent ?? 0,
      articleId: null,
    }));
  }
  return [{ ...defaultLineItem }];
}

export function invoiceToFormState(
  inv: ParsedInvoice,
  dbLines: ParsedInvoiceLine[],
  partners: Partner[]
): FormState {
  const { recipient, selectedPartnerId } = recipientFromInvoice(inv, partners);
  return {
    recipient,
    selectedPartnerId,
    docType: inv.docType,
    issueDate: inv.issueDate,
    supplyDate: inv.supplyDate ?? inv.issueDate,
    language: inv.language ?? 'bg',
    currency: inv.currency ?? 'EUR',
    fxRate: Number(inv.fxRate ?? 1),
    lineItems: lineItemsFromInvoice(inv, dbLines),
    vatMode: inv.vatMode,
    noVatReason: inv.noVatReason ?? '',
    amountInWordsOverride: '',
    paymentMethod: inv.paymentMethod,
    paymentStatus: inv.paymentStatus,
    dueDate: inv.dueDate ?? '',
    customerNote: inv.customerNote ?? '',
    internalComment: inv.internalComment ?? '',
  };
}

/**
 * Form state for "copy invoice": clone partner, line items, currency, payment
 * method and VAT mode from the source, but start a FRESH document — today's
 * dates, unpaid, always a regular invoice (a copied note would need its own
 * reference), no notes, and no number (allocated on first save).
 */
export function invoiceToCopyFormState(
  inv: ParsedInvoice,
  dbLines: ParsedInvoiceLine[],
  partners: Partner[]
): FormState {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...invoiceToFormState(inv, dbLines, partners),
    docType: 'invoice',
    issueDate: today,
    supplyDate: today,
    dueDate: '',
    paymentStatus: 'unpaid',
    customerNote: '',
    internalComment: '',
  };
}

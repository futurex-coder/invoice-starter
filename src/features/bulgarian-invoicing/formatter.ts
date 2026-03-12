/**
 * Display formatting utilities for Bulgarian invoices.
 *
 * Pure functions — no side effects.
 */

import type { InvoiceDocument, LineItem, PartySnapshot } from './types';
import { MONEY_PRECISION, QUANTITY_PRECISION } from './rules';

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/**
 * Zero-pad an invoice number to 10 digits as required by NRA.
 * Returns empty string for null/undefined.
 */
export function formatInvoiceNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '';
  return String(n).padStart(10, '0');
}

/**
 * Format a monetary amount with 2 decimals and optional thousands separator.
 */
export function formatMoney(
  amount: number,
  options?: { thousandsSeparator?: string; decimalSeparator?: string }
): string {
  const sep = options?.thousandsSeparator ?? ' ';
  const dec = options?.decimalSeparator ?? '.';
  const fixed = Math.abs(amount).toFixed(MONEY_PRECISION);
  const [intPart, decPart] = fixed.split('.');
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  const sign = amount < 0 ? '-' : '';
  return `${sign}${withSep}${dec}${decPart}`;
}

/**
 * Format a quantity with up to 4 significant decimal places,
 * trimming trailing zeros.
 */
export function formatQuantity(qty: number): string {
  return Number(qty.toFixed(QUANTITY_PRECISION)).toString();
}

/**
 * Format a VAT rate for display: "20%", "9%", "0%".
 */
export function formatVatRate(rate: number): string {
  return `${rate}%`;
}

// ---------------------------------------------------------------------------
// Party formatting
// ---------------------------------------------------------------------------

/**
 * Format party info into multi-line text for invoice rendering.
 */
export function formatParty(party: PartySnapshot): string {
  const lines: string[] = [
    party.legalName,
    party.address,
    `UIC: ${party.uic}`,
  ];
  if (party.vatNumber) {
    lines.push(`VAT: ${party.vatNumber}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Line item table row
// ---------------------------------------------------------------------------

export interface FormattedLineItem {
  sortOrder: number;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountPercent: string;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  grossAmount: string;
}

export function formatLineItem(item: LineItem): FormattedLineItem {
  return {
    sortOrder: item.sortOrder + 1,
    description: item.description,
    quantity: formatQuantity(item.quantity),
    unit: item.unit,
    unitPrice: formatMoney(item.unitPrice),
    discountPercent: item.discountPercent ? `${item.discountPercent}%` : '-',
    netAmount: formatMoney(item.netAmount),
    vatRate: formatVatRate(item.vatRate),
    vatAmount: formatMoney(item.vatAmount),
    grossAmount: formatMoney(item.grossAmount),
  };
}

// ---------------------------------------------------------------------------
// Full document header
// ---------------------------------------------------------------------------

const DOC_TYPE_LABELS: Record<string, string> = {
  invoice: 'Фактура',
  proforma: 'Проформа фактура',
  credit_note: 'Кредитно известие',
  debit_note: 'Дебитно известие',
};

/**
 * Localised label for the document type (Bulgarian).
 */
export function formatDocTypeLabel(docType: string): string {
  return DOC_TYPE_LABELS[docType] ?? docType;
}

/**
 * Format date as DD.MM.YYYY (Bulgarian convention).
 */
export function formatDateBg(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Build a short document title: "Фактура № 0000000001 / 28.02.2026"
 */
export function formatDocumentTitle(doc: InvoiceDocument): string {
  const label = formatDocTypeLabel(doc.docType);
  const num = formatInvoiceNumber(doc.number);
  const dateStr = formatDateBg(doc.issueDate);
  if (num) {
    return `${label} № ${num} / ${dateStr}`;
  }
  return `${label} (чернова) / ${dateStr}`;
}

// ---------------------------------------------------------------------------
// Print model — structured data for print/preview layout
// ---------------------------------------------------------------------------

/** Uppercase document type for print header */
const DOC_TYPE_LABELS_UPPER: Record<string, string> = {
  invoice: 'ФАКТУРА',
  proforma: 'ПРОФОРМА ФАКТУРА',
  credit_note: 'КРЕДИТНО ИЗВЕСТИЕ',
  debit_note: 'ДЕБИТНО ИЗВЕСТИЕ',
};

export const PRINT_ORIGINAL_LABEL = 'ОРИГИНАЛ';

export interface PrintModelParty {
  legalName: string;
  address: string;
  eik: string;
  vatNumber: string | null;
}

export interface PrintModelItem {
  no: number;
  artukul: string;
  quantity: string;
  unitPrice: string;
  stoimost: string;
}

export interface PrintModelTotals {
  danuchnaOsnova: string;
  ddsPercent: string;
  ddsAmount: string;
  sumaZaPlashtane: string;
  currency: string;
}

export interface PrintModel {
  docTypeTitle: string;
  originalLabel: string;
  invoiceNumber: string;
  issueDate: string;
  taxEventDate: string | null;
  supplier: PrintModelParty;
  recipient: PrintModelParty;
  items: PrintModelItem[];
  totals: PrintModelTotals;
  amountInWords: string | null;
  paymentMethodLabel: string;
  createdBy: string;
  currencyConversion: { amountEur: string; rate: number; amountBgn: string } | null;
  bankDetails: { bankName: string; iban: string; bic: string | null } | null;
}

/** Input shape for building print model (invoice row or similar) */
export interface InvoiceForPrint {
  docType: string;
  number: number | null;
  issueDate: string;
  supplyDate: string | null;
  currency: string;
  fxRate: string | number;
  supplierSnapshot: unknown;
  recipientSnapshot: unknown;
  items: unknown;
  totals: unknown;
  amountInWords: string | null;
  paymentMethod: string | null;
  createdByUserName?: string | null;
}

function partyToPrintParty(p: { legalName?: string; address?: string; uic?: string; vatNumber?: string | null } | null): PrintModelParty {
  if (!p) return { legalName: '', address: '', eik: '', vatNumber: null };
  return {
    legalName: p.legalName ?? '',
    address: p.address ?? '',
    eik: p.uic ?? '',
    vatNumber: p.vatNumber ?? null,
  };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank: 'Банков път',
  cash: 'В брой',
  barter: 'Бартер',
};

/**
 * Build a PrintModel from an invoice-like object. Use formatter for all display strings.
 */
export function buildPrintModel(
  invoice: InvoiceForPrint,
  options?: { createdByName?: string | null }
): PrintModel {
  const supplier = partyToPrintParty(invoice.supplierSnapshot as PartySnapshot);
  const recipient = partyToPrintParty(invoice.recipientSnapshot as PartySnapshot);
  const items = (invoice.items ?? []) as LineItem[];
  const totals = (invoice.totals ?? { netAmount: 0, vatAmount: 0, grossAmount: 0, vatBreakdown: [] }) as {
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
    vatBreakdown: Array<{ vatRate: number; vatAmount: number }>;
  };
  const fxRate = Number(invoice.fxRate ?? 1);
  const currency = (invoice.currency ?? 'EUR').toUpperCase();
  const isEur = currency === 'EUR';

  const formattedItems = items.map((item, i) => {
    const row = formatLineItem(item);
    return {
      no: i + 1,
      artukul: row.description,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      stoimost: row.grossAmount,
    };
  });

  const vatPercent =
    totals.vatBreakdown?.length === 1
      ? totals.vatBreakdown[0].vatRate
      : totals.netAmount > 0
        ? Math.round((totals.vatAmount / totals.netAmount) * 100)
        : 0;

  const supplierSnap = invoice.supplierSnapshot as PartySnapshot & { bankName?: string; iban?: string; bic?: string };
  const bankDetails =
    invoice.paymentMethod === 'bank' &&
    supplierSnap?.iban
      ? {
          bankName: supplierSnap.bankName ?? '',
          iban: supplierSnap.iban,
          bic: supplierSnap.bic ?? null,
        }
      : null;

  const createdBy =
    options?.createdByName ?? invoice.createdByUserName ?? '';

  return {
    docTypeTitle: DOC_TYPE_LABELS_UPPER[invoice.docType] ?? invoice.docType.toUpperCase(),
    originalLabel: PRINT_ORIGINAL_LABEL,
    invoiceNumber: invoice.number != null ? formatInvoiceNumber(invoice.number) : '—',
    issueDate: formatDateBg(invoice.issueDate),
    taxEventDate: invoice.supplyDate ? formatDateBg(invoice.supplyDate) : null,
    supplier,
    recipient,
    items: formattedItems,
    totals: {
      danuchnaOsnova: formatMoney(totals.netAmount),
      ddsPercent: `${vatPercent}%`,
      ddsAmount: formatMoney(totals.vatAmount),
      sumaZaPlashtane: formatMoney(totals.grossAmount),
      currency,
    },
    amountInWords: invoice.amountInWords?.trim() || null,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[invoice.paymentMethod ?? ''] ?? (invoice.paymentMethod ?? 'Банков път'),
    createdBy,
    currencyConversion: isEur && fxRate !== 1
      ? {
          amountEur: formatMoney(totals.grossAmount),
          rate: fxRate,
          amountBgn: formatMoney(totals.grossAmount * fxRate),
        }
      : null,
    bankDetails,
  };
}

// ---------------------------------------------------------------------------
// Amount in words (Словом) — Bulgarian
// ---------------------------------------------------------------------------

const BG_ONES = ['', 'един', 'два', 'три', 'четири', 'пет', 'шест', 'седем', 'осем', 'девет'];
const BG_TEENS = ['десет', 'единадесет', 'дванадесет', 'тринадесет', 'четиринадесет', 'петнадесет', 'шестнадесет', 'седемнадесет', 'осемнадесет', 'деветнадесет'];
const BG_TENS = ['', '', 'двадесет', 'тридесет', 'четиридесет', 'петдесет', 'шестдесет', 'седемдесет', 'осемдесет', 'деветдесет'];
const BG_HUNDRED = 'сто';
const BG_HUNDREDS = ['', 'сто', 'двеста', 'триста', 'четиристотин', 'петстотин', 'шестстотин', 'седемстотин', 'осемстотин', 'деветстотин'];

function numberToWordsBg(n: number): string {
  const int = Math.floor(Math.abs(n));
  if (int === 0) return 'нула';
  if (int >= 1_000_000_000) return String(int); // fallback for huge numbers

  const parts: string[] = [];
  let rest = int;

  if (rest >= 1_000_000) {
    const mil = Math.floor(rest / 1_000_000);
    rest %= 1_000_000;
    if (mil === 1) parts.push('един милион');
    else parts.push(numberToWordsBg(mil) + ' милиона');
  }
  if (rest >= 1_000) {
    const thou = Math.floor(rest / 1_000);
    rest %= 1_000;
    if (thou === 1) parts.push('хиляда');
    else if (thou < 20) parts.push(numberToWordsBg(thou) + ' хиляди');
    else parts.push(numberToWordsBg(thou) + ' хиляди');
  }
  if (rest >= 100) {
    const h = Math.floor(rest / 100);
    rest %= 100;
    parts.push(BG_HUNDREDS[h]);
  }
  if (rest >= 20) {
    const t = Math.floor(rest / 10);
    rest %= 10;
    parts.push(BG_TENS[t]);
  }
  if (rest >= 10) {
    parts.push(BG_TEENS[rest - 10]);
    rest = 0;
  }
  if (rest > 0) {
    parts.push(BG_ONES[rest]);
  }

  return parts.filter(Boolean).join(' и ');
}

/**
 * Format amount as words in Bulgarian (Словом). Mandatory on invoices.
 * e.g. amountInWordsBg(1234.56, 'EUR') => "хиляда двеста тридесет и четири евро и 56 цента"
 */
export function amountInWordsBg(amount: number, currency: string): string {
  const abs = Math.abs(amount);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  const curr = currency.toUpperCase();
  const isEur = curr === 'EUR';
  const mainUnit = intPart === 1 ? (isEur ? 'евро' : 'лев') : isEur ? 'евро' : 'лева';
  const subUnit = isEur ? (decPart === 1 ? 'цент' : 'цента') : decPart === 1 ? 'стотинка' : 'стотинки';

  const intWords = numberToWordsBg(intPart);
  const mainStr = intPart === 0 ? 'нула ' + mainUnit : intWords + ' ' + mainUnit;
  if (decPart === 0) return mainStr;
  return mainStr + ' и ' + decPart + ' ' + subUnit;
}

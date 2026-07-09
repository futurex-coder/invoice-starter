/**
 * KONT-1 Slice 1 — read-only ДДС дневник (VAT ledger) rows, one per document.
 *
 * The per-document breakdown behind `getVatSummary`'s monthly net number. Reuses
 * the canonical money.ts primitives (signed*, credit notes negative, finalized
 * non-proforma, × frozen fxRate → company base currency) so the rows RECONCILE:
 *   Σ(sales rows' vatBase for a month)     === getVatSummary.vatIssued
 *   Σ(purchase rows' vatBase for a month)   === getVatSummary.vatPaid  (CN-free)
 *
 * Base amounts are returned at full precision; round for display only (rounding
 * once at the monthly total is what matches getVatSummary — WIRING #15/P7).
 */

import { and, eq, ne, gte, lte, isNull, sql } from 'drizzle-orm';
import { db } from '../drizzle';
import { invoices, receivedInvoices } from '../schema';
import { signedNetSql, signedVatSql, signedGrossSql } from './money';
import {
  deriveSaleVatOperation,
  type VatOperation,
} from '@/src/features/kontirovka/vat-operations';

export interface DateRange {
  /** inclusive ISO date 'YYYY-MM-DD' */
  from: string;
  /** inclusive ISO date 'YYYY-MM-DD' */
  to: string;
}

export interface SalesLedgerRow {
  id: number;
  docType: string;
  number: number;
  issueDate: string;
  partnerName: string | null;
  partnerEik: string | null;
  partnerVat: string | null;
  /** данъчна основа in company base currency (signed: CN negative). */
  netBase: number;
  /** начислен ДДС in company base currency (signed). */
  vatBase: number;
  /** обща стойност in company base currency (signed). */
  grossBase: number;
  /** effective document VAT rate (for the label; per-line rates arrive later). */
  vatRate: number;
  /** derived "Операция по ДДС" (exact-keyed; free-text → 'unclassified'). */
  vatOperation: VatOperation;
  currency: string;
  fxRate: number;
}

export interface PurchaseLedgerRow {
  id: number;
  invoiceNumber: string | null;
  issueDate: string | null;
  supplierName: string | null;
  supplierEik: string | null;
  supplierVat: string | null;
  netBase: number;
  vatBase: number;
  grossBase: number;
  vatRate: number;
  vatOperation: VatOperation;
  currency: string;
  fxRate: number;
}

function effectiveRate(netDoc: number, vatDoc: number): number {
  return netDoc > 0 ? Math.round((vatDoc / netDoc) * 100) : 0;
}

/**
 * Дневник продажби rows — finalized non-proforma outgoing documents issued in
 * [from, to]. Credit notes carry NEGATIVE base/vat/gross (сторно), matching
 * signedVatSql, so the month total reconciles to getVatSummary.vatIssued.
 */
export async function getSalesLedger(
  companyId: number,
  range: DateRange
): Promise<SalesLedgerRow[]> {
  const rows = await db
    .select({
      id: invoices.id,
      docType: invoices.docType,
      number: invoices.number,
      issueDate: invoices.issueDate,
      partnerName: sql<string | null>`${invoices.recipientSnapshot}->>'legalName'`,
      partnerEik: sql<string | null>`${invoices.recipientSnapshot}->>'uic'`,
      partnerVat: sql<string | null>`${invoices.recipientSnapshot}->>'vatNumber'`,
      currency: invoices.currency,
      fxRate: invoices.fxRate,
      vatMode: invoices.vatMode,
      noVatReason: invoices.noVatReason,
      netBase: signedNetSql,
      vatBase: signedVatSql,
      grossBase: signedGrossSql,
      netDoc: sql<string>`COALESCE((${invoices.totals}->>'netAmount')::numeric, 0)`,
      vatDoc: sql<string>`COALESCE((${invoices.totals}->>'vatAmount')::numeric, 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.companyId, companyId),
        eq(invoices.status, 'finalized'),
        ne(invoices.docType, 'proforma'),
        gte(invoices.issueDate, range.from),
        lte(invoices.issueDate, range.to)
      )
    )
    .orderBy(invoices.issueDate, invoices.number);

  return rows.map((r) => {
    const rate = effectiveRate(parseFloat(r.netDoc), parseFloat(r.vatDoc));
    return {
      id: r.id,
      docType: r.docType,
      number: r.number,
      issueDate: r.issueDate,
      partnerName: r.partnerName,
      partnerEik: r.partnerEik,
      partnerVat: r.partnerVat,
      netBase: parseFloat(r.netBase),
      vatBase: parseFloat(r.vatBase),
      grossBase: parseFloat(r.grossBase),
      vatRate: rate,
      vatOperation: deriveSaleVatOperation(r.vatMode, rate, r.noVatReason),
      currency: r.currency,
      fxRate: parseFloat(r.fxRate),
    };
  });
}

/**
 * Дневник покупки rows — confirmed, non-archived received documents dated in
 * [from, to]. Received invoices have no docType yet (WIRING #5), so all rows are
 * positive and the reconciliation to getVatSummary.vatPaid holds for CN-free
 * months. Classification is assisted-manual (Slice 3); the label defaults to
 * full-credit by effective rate.
 */
export async function getPurchaseLedger(
  companyId: number,
  range: DateRange
): Promise<PurchaseLedgerRow[]> {
  const rows = await db
    .select({
      id: receivedInvoices.id,
      invoiceNumber: receivedInvoices.invoiceNumber,
      issueDate: receivedInvoices.issueDate,
      supplierName: sql<string | null>`${receivedInvoices.supplierSnapshot}->>'legalName'`,
      supplierEik: sql<string | null>`${receivedInvoices.supplierSnapshot}->>'eik'`,
      supplierVat: sql<string | null>`${receivedInvoices.supplierSnapshot}->>'vatNumber'`,
      currency: receivedInvoices.currency,
      fxRate: receivedInvoices.fxRate,
      netBase: sql<string>`${receivedInvoices.netAmount}::numeric * ${receivedInvoices.fxRate}::numeric`,
      vatBase: sql<string>`${receivedInvoices.vatAmount}::numeric * ${receivedInvoices.fxRate}::numeric`,
      grossBase: sql<string>`${receivedInvoices.grossAmount}::numeric * ${receivedInvoices.fxRate}::numeric`,
      netDoc: sql<string>`${receivedInvoices.netAmount}::numeric`,
      vatDoc: sql<string>`${receivedInvoices.vatAmount}::numeric`,
    })
    .from(receivedInvoices)
    .where(
      and(
        eq(receivedInvoices.companyId, companyId),
        eq(receivedInvoices.status, 'confirmed'),
        isNull(receivedInvoices.archivedAt),
        gte(receivedInvoices.issueDate, range.from),
        lte(receivedInvoices.issueDate, range.to)
      )
    )
    .orderBy(receivedInvoices.issueDate, receivedInvoices.id);

  return rows.map((r) => {
    const rate = effectiveRate(parseFloat(r.netDoc), parseFloat(r.vatDoc));
    const vatOperation: VatOperation =
      rate === 9 ? 'purchase_full_9' : 'purchase_full_20';
    return {
      id: r.id,
      invoiceNumber: r.invoiceNumber,
      issueDate: r.issueDate,
      supplierName: r.supplierName,
      supplierEik: r.supplierEik,
      supplierVat: r.supplierVat,
      netBase: parseFloat(r.netBase),
      vatBase: parseFloat(r.vatBase),
      grossBase: parseFloat(r.grossBase),
      vatRate: rate,
      vatOperation,
      currency: r.currency,
      fxRate: parseFloat(r.fxRate),
    };
  });
}

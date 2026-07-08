import { sql, type SQL } from 'drizzle-orm';
import { invoices } from '../schema';

/**
 * Canonical money-aggregation rules for OUTGOING documents (AGG-1).
 *
 * - Only `finalized` documents carry financial weight (drafts and cancelled
 *   docs never count).
 * - Credit notes SUBTRACT their gross; invoices and debit notes ADD it.
 * - `paymentStatus` buckets: 'paid' → collected ("revenue" — a cash view);
 *   anything else (unpaid | partial) → outstanding. A partially-paid document
 *   is money still being collected — it must never vanish from both buckets.
 * - On notes, `paymentStatus` means "has the refund/offset been settled":
 *   a paid CN reduces collected cash; an unpaid CN reduces the receivable.
 *
 * ⚠️ Amounts are still summed in the documents' own currencies — converting
 * to the company base currency is GEN-1 (blocked on D-FX). Keep any new
 * aggregate on these helpers so the FX conversion lands in one place.
 */

/** Signed gross amount: credit notes negative, everything else positive. */
export const signedGrossSql: SQL<string> = sql`
  CASE WHEN ${invoices.docType} = 'credit_note'
       THEN -(${invoices.totals}->>'grossAmount')::numeric
       ELSE (${invoices.totals}->>'grossAmount')::numeric END`;

/** Collected money (cash view): finalized docs whose payment is settled. */
export const collectedSumSql: SQL<string> = sql`
  COALESCE(SUM(
    CASE WHEN ${invoices.status} = 'finalized'
         AND ${invoices.paymentStatus} = 'paid'
    THEN ${signedGrossSql}
    ELSE 0 END
  ), 0)`;

/** Outstanding receivable: finalized docs not fully paid (incl. partial). */
export const outstandingSumSql: SQL<string> = sql`
  COALESCE(SUM(
    CASE WHEN ${invoices.status} = 'finalized'
         AND ${invoices.paymentStatus} <> 'paid'
    THEN ${signedGrossSql}
    ELSE 0 END
  ), 0)`;

/**
 * Overdue documents: not fully paid past their due date. A count, not an
 * amount — a fully credit-noted invoice still shows up here until its
 * paymentStatus is resolved (documented limitation; amount-level netting
 * only happens in the sums above).
 */
export const overdueCountSql: SQL<number> = sql`
  COUNT(*) FILTER (
    WHERE ${invoices.docType} = 'invoice'
      AND ${invoices.status} = 'finalized'
      AND ${invoices.paymentStatus} <> 'paid'
      AND ${invoices.dueDate}::date < CURRENT_DATE
  )`;

/** Signed VAT amount: credit notes negative, everything else positive. */
export const signedVatSql: SQL<string> = sql`
  CASE WHEN ${invoices.docType} = 'credit_note'
       THEN -(${invoices.totals}->>'vatAmount')::numeric
       ELSE (${invoices.totals}->>'vatAmount')::numeric END`;

/**
 * VAT charged on issued documents — ACCRUAL basis: every finalized document
 * counts regardless of payment (ЗДДС owes VAT on issuance, not collection).
 * Credit notes subtract, debit notes add. Used by VAT-1.
 */
export const issuedVatSumSql: SQL<string> = sql`
  COALESCE(SUM(
    CASE WHEN ${invoices.status} = 'finalized'
    THEN ${signedVatSql}
    ELSE 0 END
  ), 0)`;

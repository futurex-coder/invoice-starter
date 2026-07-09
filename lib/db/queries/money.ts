import { sql, type SQL } from 'drizzle-orm';
import { invoices } from '../schema';

/**
 * Canonical money-aggregation rules for OUTGOING documents (AGG-1).
 *
 * - Only `finalized` documents carry financial weight (drafts and cancelled
 *   docs never count). Proformas NEVER count — they are non-binding quotes, not
 *   tax documents, so they are excluded from every money/VAT aggregate here.
 * - Credit notes SUBTRACT their gross; invoices and debit notes ADD it.
 * - `paymentStatus` buckets: 'paid' → collected ("revenue" — a cash view);
 *   anything else (unpaid | partial) → outstanding. A partially-paid document
 *   is money still being collected — it must never vanish from both buckets.
 * - On notes, `paymentStatus` means "has the refund/offset been settled":
 *   a paid CN reduces collected cash; an unpaid CN reduces the receivable.
 *
 * GEN-1: amounts are converted to the company base currency here — each row's
 * signed amount is multiplied by its frozen `fxRate` (amount_base = amount_doc
 * × fxRate), so every SUM below is already in the base currency. This is the
 * single insertion point; keep any new aggregate on these helpers.
 */

/**
 * Signed gross amount in the COMPANY BASE currency: credit notes negative,
 * everything else positive, each converted via its frozen fxRate.
 */
export const signedGrossSql: SQL<string> = sql`
  (CASE WHEN ${invoices.docType} = 'credit_note'
        THEN -(${invoices.totals}->>'grossAmount')::numeric
        ELSE (${invoices.totals}->>'grossAmount')::numeric END)
  * ${invoices.fxRate}::numeric`;

/**
 * Signed net (данъчна основа) amount in the COMPANY BASE currency: credit notes
 * negative, everything else positive, each converted via its frozen fxRate.
 * Used by the ДДС-дневник per-document rows (KONT-1 Slice 1).
 */
export const signedNetSql: SQL<string> = sql`
  (CASE WHEN ${invoices.docType} = 'credit_note'
        THEN -(${invoices.totals}->>'netAmount')::numeric
        ELSE (${invoices.totals}->>'netAmount')::numeric END)
  * ${invoices.fxRate}::numeric`;

/** Collected money (cash view): finalized docs whose payment is settled. */
export const collectedSumSql: SQL<string> = sql`
  COALESCE(SUM(
    CASE WHEN ${invoices.status} = 'finalized'
         AND ${invoices.docType} <> 'proforma'
         AND ${invoices.paymentStatus} = 'paid'
    THEN ${signedGrossSql}
    ELSE 0 END
  ), 0)`;

/** Outstanding receivable: finalized docs not fully paid (incl. partial). */
export const outstandingSumSql: SQL<string> = sql`
  COALESCE(SUM(
    CASE WHEN ${invoices.status} = 'finalized'
         AND ${invoices.docType} <> 'proforma'
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

/**
 * Signed VAT amount in the COMPANY BASE currency: credit notes negative,
 * everything else positive, each converted via its frozen fxRate.
 */
export const signedVatSql: SQL<string> = sql`
  (CASE WHEN ${invoices.docType} = 'credit_note'
        THEN -(${invoices.totals}->>'vatAmount')::numeric
        ELSE (${invoices.totals}->>'vatAmount')::numeric END)
  * ${invoices.fxRate}::numeric`;

/**
 * VAT charged on issued documents — ACCRUAL basis: every finalized document
 * counts regardless of payment (ЗДДС owes VAT on issuance, not collection).
 * Credit notes subtract, debit notes add. Used by VAT-1.
 */
export const issuedVatSumSql: SQL<string> = sql`
  COALESCE(SUM(
    CASE WHEN ${invoices.status} = 'finalized'
         AND ${invoices.docType} <> 'proforma'
    THEN ${signedVatSql}
    ELSE 0 END
  ), 0)`;

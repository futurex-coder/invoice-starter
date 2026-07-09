'use server';

import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  invoices,
  journalEntries,
  journalLines,
  journalTaxLines,
  ActivityType,
  type Invoice,
} from '@/lib/db/schema';
import { action, type ActionResult } from '@/lib/actions/result';
import { requireCompanyAccess } from '@/lib/auth/guards';
import { logActivity } from '@/lib/db/activity';
import {
  getSalesLedger,
  getPurchaseLedger,
  type SalesLedgerRow,
  type PurchaseLedgerRow,
} from '@/lib/db/queries/dnevnik';
import {
  parseInvoiceTotalsStrict,
  parsePartySnapshotStrict,
} from '@/src/features/bulgarian-invoicing/parsers';
import { formatDocTypeLabel } from '@/src/features/bulgarian-invoicing/formatter';
import { buildContra, type ContraLine, type AccountingBasis } from './contra';
import {
  deriveSaleVatOperation,
  getVatOperationMeta,
  type VatOperation,
} from './vat-operations';

export interface MonthDnevnik {
  /** The ISO month these ledgers cover, e.g. "2026-07". */
  month: string;
  /** Дневник продажби — one row per outgoing document. */
  sales: SalesLedgerRow[];
  /** Дневник покупки — one row per confirmed received document. */
  purchases: PurchaseLedgerRow[];
}

/**
 * KONT-1 Slice 1 — the per-document ДДС дневник (sales + purchases) behind a
 * single month on the VAT page. Read-only: it reconciles to getVatSummary for
 * that month (Σ sales vat === vatIssued, Σ purchase vat === vatPaid CN-free).
 */
export async function getDnevnikForMonth(
  month: string
): Promise<ActionResult<MonthDnevnik>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();

    const m = /^(\d{4})-(\d{2})$/.exec(month);
    if (!m) throw new Error('Невалиден месец');
    const year = Number(m[1]);
    const mon = Number(m[2]);
    if (mon < 1 || mon > 12) throw new Error('Невалиден месец');
    // last calendar day of the month (date column comparison must be valid)
    const lastDay = new Date(year, mon, 0).getDate();
    const range = {
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, '0')}`,
    };

    const [sales, purchases] = await Promise.all([
      getSalesLedger(companyId, range),
      getPurchaseLedger(companyId, range),
    ]);

    return { month, sales, purchases };
  });
}

// ---------------------------------------------------------------------------
// Контировка — derive + post a double-entry entry from an outgoing invoice.
// Sales only (Slice 2); purchases are assisted-manual (Slice 3). The derived
// draft is what Меню Контиране shows; posting persists it (balanced, immutable).
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function docTypeCodeOf(docType: string): string {
  // НАП вид на документа: 01 фактура, 02 дебитно известие, 03 кредитно известие
  if (docType === 'credit_note') return '03';
  if (docType === 'debit_note') return '02';
  return '01';
}

interface DerivedContra {
  net: number;
  vat: number;
  gross: number;
  fxRate: number;
  vatOperation: VatOperation;
  basis: AccountingBasis;
  partnerName: string;
  partnerUic: string | null;
  partnerVat: string | null;
  lines: ContraLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}

/** Derive the sale контировка for a finalized outgoing invoice (pure over the row). */
function deriveInvoiceContra(inv: Invoice): DerivedContra {
  const totals = parseInvoiceTotalsStrict(inv.totals);
  const recipient = parsePartySnapshotStrict(inv.recipientSnapshot);
  const net = totals.netAmount;
  const vat = totals.vatAmount;
  const gross = totals.grossAmount;
  const effRate = net > 0 ? Math.round((vat / net) * 100) : 0;
  const vatOperation = deriveSaleVatOperation(inv.vatMode, effRate, inv.noVatReason);
  const basis: AccountingBasis = 'services'; // MVP default; Основание editable later
  const fxRate = Number(inv.fxRate);
  const contra = buildContra({
    dealType: 'sale',
    docType: inv.docType,
    vatOperation,
    basis,
    currency: inv.currency,
    net,
    vat,
    gross,
  });
  return {
    net,
    vat,
    gross,
    fxRate,
    vatOperation,
    basis,
    partnerName: recipient.legalName,
    partnerUic: recipient.uic || null,
    partnerVat: recipient.vatNumber ?? null,
    lines: contra.lines,
    totalDebit: contra.totalDebit,
    totalCredit: contra.totalCredit,
    balanced: contra.balanced,
  };
}

export interface ContraPreview {
  invoiceId: number;
  documentType: string;
  documentNumber: string;
  documentDate: string;
  partnerName: string;
  partnerUic: string | null;
  dealType: 'sale';
  vatOperation: VatOperation;
  vatOperationLabel: string;
  basis: AccountingBasis;
  vies: boolean;
  vatPeriod: string;
  currency: string;
  lines: ContraLine[];
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  alreadyPosted: boolean;
  postingNumber: number | null;
}

async function loadInvoiceForPosting(
  companyId: number,
  invoiceId: number
): Promise<Invoice> {
  const [inv] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)))
    .limit(1);
  if (!inv) throw new Error('Фактурата не е намерена');
  if (inv.status !== 'finalized') {
    throw new Error('Само финализирани документи се осчетоводяват');
  }
  if (inv.docType === 'proforma') {
    throw new Error('Проформа фактурите не се осчетоводяват');
  }
  return inv;
}

/** The Меню-Контиране preview: the derived Дт/Кт for an invoice (read-only). */
export async function getInvoiceContraPreview(
  invoiceId: number
): Promise<ActionResult<ContraPreview>> {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();
    const inv = await loadInvoiceForPosting(companyId, invoiceId);
    const d = deriveInvoiceContra(inv);
    const meta = getVatOperationMeta(d.vatOperation);

    const [existing] = await db
      .select({
        id: journalEntries.id,
        postingNumber: journalEntries.postingNumber,
      })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.sourceInvoiceId, invoiceId),
          ne(journalEntries.status, 'reversed')
        )
      )
      .limit(1);

    return {
      invoiceId,
      documentType: formatDocTypeLabel(inv.docType),
      documentNumber: String(inv.number).padStart(10, '0'),
      documentDate: inv.issueDate,
      partnerName: d.partnerName,
      partnerUic: d.partnerUic,
      dealType: 'sale',
      vatOperation: d.vatOperation,
      vatOperationLabel: meta.label,
      basis: d.basis,
      vies: meta.vies,
      vatPeriod: inv.issueDate.slice(0, 7),
      currency: inv.currency,
      lines: d.lines,
      totalDebit: d.totalDebit,
      totalCredit: d.totalCredit,
      balanced: d.balanced,
      alreadyPosted: !!existing,
      postingNumber: existing?.postingNumber ?? null,
    };
  });
}

/** Post the derived контировка for an invoice — one balanced, immutable entry. */
export async function postInvoiceContra(
  invoiceId: number
): Promise<ActionResult<{ entryId: number; postingNumber: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();
    const inv = await loadInvoiceForPosting(companyId, invoiceId);

    const [existing] = await db
      .select({ id: journalEntries.id })
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.sourceInvoiceId, invoiceId),
          ne(journalEntries.status, 'reversed')
        )
      )
      .limit(1);
    if (existing) throw new Error('Документът вече е осчетоводен');

    const d = deriveInvoiceContra(inv);
    if (!d.balanced) throw new Error('Контировката не е балансирана');
    const meta = getVatOperationMeta(d.vatOperation);
    const sign = inv.docType === 'credit_note' ? -1 : 1;
    const today = new Date().toISOString().slice(0, 10);
    const vatPeriod = inv.issueDate.slice(0, 7);

    const result = await db.transaction(async (tx) => {
      const seq = await tx.execute<{ allocated: number }>(sql`
        INSERT INTO journal_sequences (company_id, next_number, updated_at)
        VALUES (${companyId}, 2, NOW())
        ON CONFLICT (company_id)
        DO UPDATE SET next_number = journal_sequences.next_number + 1, updated_at = NOW()
        RETURNING next_number - 1 AS allocated
      `);
      const postingNumber = Number(seq[0]?.['allocated']);

      const [entry] = await tx
        .insert(journalEntries)
        .values({
          companyId,
          postingNumber,
          postingDate: today,
          kind: 'document',
          docTypeCode: docTypeCodeOf(inv.docType),
          documentType: formatDocTypeLabel(inv.docType),
          documentNumber: String(inv.number).padStart(10, '0'),
          documentDate: inv.issueDate,
          dealType: 'sale',
          vatOperation: d.vatOperation,
          basis: d.basis,
          partnerId: inv.partnerId,
          partnerName: d.partnerName,
          partnerUic: d.partnerUic,
          partnerVat: d.partnerVat,
          vies: meta.vies,
          vatPeriod,
          currency: inv.currency,
          fxRate: String(d.fxRate),
          sourceInvoiceId: invoiceId,
          status: 'posted',
          createdByUserId: user.id,
          postedAt: new Date(),
        })
        .returning({ id: journalEntries.id });
      if (!entry) throw new Error('Неуспешно създаване на контировка');

      await tx.insert(journalLines).values(
        d.lines.map((l, i) => ({
          journalEntryId: entry.id,
          side: l.side,
          accountCode: l.code,
          accountName: l.name,
          amount: String(l.amount),
          amountBase: String(round2(l.amount * d.fxRate)),
          sortOrder: i,
        }))
      );

      await tx.insert(journalTaxLines).values({
        journalEntryId: entry.id,
        vatOperation: d.vatOperation,
        register: meta.register,
        baseCell: meta.baseCell != null ? String(meta.baseCell) : null,
        vatCell: meta.vatCell != null ? String(meta.vatCell) : null,
        base: String(round2(d.net * sign)),
        baseBase: String(round2(d.net * sign * d.fxRate)),
        vat: String(round2(d.vat * sign)),
        vatBase: String(round2(d.vat * sign * d.fxRate)),
      });

      return { entryId: entry.id, postingNumber };
    });

    // Lock the source document (EDIT-RULE): accounted = immutable until reversed.
    await db
      .update(invoices)
      .set({ accountingStatus: 'accounted', updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)));

    await logActivity(companyId, user.id, ActivityType.POST_JOURNAL_ENTRY);

    return result;
  });
}

/**
 * Reverse (сторнирай) the active контировка of an invoice. Corrections never
 * mutate a posted entry (the DB freezes it); instead we write a mirror-negated
 * counter-entry and flip the original to 'reversed'. The source document is
 * unlocked (accountingStatus → 'pending') so it can be corrected and re-posted.
 *
 * Convention: червено сторно — same accounts/sides, NEGATED amounts. The дневник
 * and getVatSummary sum signed amounts, so the reversal nets the original out of
 * its VAT period. The reversal lands in the SAME period as the original (correct
 * for a pre-filing fix); once period-lock (Slice 4) exists, reversing a filed
 * period will place the storno in the current open period instead.
 */
export async function reverseInvoiceContra(
  invoiceId: number,
  reason?: string
): Promise<ActionResult<{ reversalEntryId: number; postingNumber: number }>> {
  return action(async () => {
    const { user, companyId } = await requireCompanyAccess();

    const [original] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.sourceInvoiceId, invoiceId),
          eq(journalEntries.companyId, companyId),
          ne(journalEntries.status, 'reversed')
        )
      )
      .limit(1);
    if (!original) throw new Error('Няма активна контировка за сторниране');
    if (original.status !== 'posted') {
      throw new Error('Само осчетоводена контировка може да се сторнира');
    }

    const [origLines, origTax] = await Promise.all([
      db
        .select()
        .from(journalLines)
        .where(eq(journalLines.journalEntryId, original.id))
        .orderBy(journalLines.sortOrder),
      db
        .select()
        .from(journalTaxLines)
        .where(eq(journalTaxLines.journalEntryId, original.id)),
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const neg = (v: string): string => String(-Number(v));

    const result = await db.transaction(async (tx) => {
      const seq = await tx.execute<{ allocated: number }>(sql`
        INSERT INTO journal_sequences (company_id, next_number, updated_at)
        VALUES (${companyId}, 2, NOW())
        ON CONFLICT (company_id)
        DO UPDATE SET next_number = journal_sequences.next_number + 1, updated_at = NOW()
        RETURNING next_number - 1 AS allocated
      `);
      const postingNumber = Number(seq[0]?.['allocated']);

      const [rev] = await tx
        .insert(journalEntries)
        .values({
          companyId,
          postingNumber,
          postingDate: today,
          kind: 'reversal',
          docTypeCode: original.docTypeCode,
          documentType: original.documentType,
          documentNumber: original.documentNumber,
          documentDate: original.documentDate,
          dealType: original.dealType,
          vatOperation: original.vatOperation,
          basis: original.basis,
          note:
            `Сторно на контировка № ${original.postingNumber}` +
            (reason ? ` — ${reason}` : ''),
          partnerId: original.partnerId,
          partnerName: original.partnerName,
          partnerUic: original.partnerUic,
          partnerVat: original.partnerVat,
          vies: original.vies,
          vatPeriod: original.vatPeriod,
          currency: original.currency,
          fxRate: original.fxRate,
          // A reversal is a counter-entry, not a booking of the document, so it
          // carries NO sourceInvoiceId — it links back via original.reversedBy.
          sourceInvoiceId: null,
          status: 'posted',
          createdByUserId: user.id,
          postedAt: new Date(),
        })
        .returning({ id: journalEntries.id });
      if (!rev) throw new Error('Неуспешно създаване на сторно контировка');

      await tx.insert(journalLines).values(
        origLines.map((l, i) => ({
          journalEntryId: rev.id,
          side: l.side,
          accountCode: l.accountCode,
          accountName: l.accountName,
          description: l.description,
          amount: neg(l.amount),
          amountBase: neg(l.amountBase),
          sortOrder: i,
        }))
      );

      if (origTax.length > 0) {
        await tx.insert(journalTaxLines).values(
          origTax.map((t) => ({
            journalEntryId: rev.id,
            vatOperation: t.vatOperation,
            register: t.register,
            baseCell: t.baseCell,
            vatCell: t.vatCell,
            base: neg(t.base),
            baseBase: neg(t.baseBase),
            vat: neg(t.vat),
            vatBase: neg(t.vatBase),
          }))
        );
      }

      // Flip the original to 'reversed' + link — the ONE mutation the DB
      // immutability trigger allows on a posted entry.
      await tx
        .update(journalEntries)
        .set({
          status: 'reversed',
          reversedByEntryId: rev.id,
          updatedAt: new Date(),
        })
        .where(eq(journalEntries.id, original.id));

      return { reversalEntryId: rev.id, postingNumber };
    });

    // Unlock the source so it can be corrected and re-posted.
    await db
      .update(invoices)
      .set({ accountingStatus: 'pending', updatedAt: new Date() })
      .where(and(eq(invoices.id, invoiceId), eq(invoices.companyId, companyId)));

    await logActivity(companyId, user.id, ActivityType.REVERSE_JOURNAL_ENTRY);

    return result;
  });
}

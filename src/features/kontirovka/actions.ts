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

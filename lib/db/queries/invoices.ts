import { desc, and, eq, sql } from 'drizzle-orm';
import { db } from '../drizzle';
import { users, invoices, invoiceSequences, partners } from '../schema';

// ─────────────────────────────────────────────
// INVOICE NUMBERING
// ─────────────────────────────────────────────

// NUM-1: one unified per-company number space for ALL document types, tracked
// under the '*' sentinel series (see allocateNumber / enforce_invoice_numbering).
const UNIFIED_SEQUENCE_KEY = '*';

/**
 * Get the next document number for a company (unified across all doc types).
 * Reads the per-company sequence tracker; falls back to MAX(number)+1 if the
 * tracker row doesn't exist yet. Returns 1 for a company with no documents.
 */
export async function getNextInvoiceNumber(companyId: number): Promise<number> {
  const seq = await db
    .select({ nextNumber: invoiceSequences.nextNumber })
    .from(invoiceSequences)
    .where(
      and(
        eq(invoiceSequences.companyId, companyId),
        eq(invoiceSequences.series, UNIFIED_SEQUENCE_KEY)
      )
    )
    .limit(1);

  if (seq[0]?.nextNumber != null) return seq[0].nextNumber;

  // Defensive: no unified tracker row yet — derive from the current max.
  const [row] = await db
    .select({ max: sql<number>`COALESCE(MAX(${invoices.number}), 0)::int` })
    .from(invoices)
    .where(eq(invoices.companyId, companyId));

  return (row?.max ?? 0) + 1;
}

// ─────────────────────────────────────────────
// COMPANY-SCOPED INVOICE QUERIES
// ─────────────────────────────────────────────

/**
 * Get invoices for a specific company with optional filters.
 */
export async function getInvoicesForCompany(
  companyId: number,
  options?: {
    status?: string;
    paymentStatus?: string;
    docType?: string;
    limit?: number;
    offset?: number;
  }
) {
  const conditions = [eq(invoices.companyId, companyId)];

  if (options?.status) {
    conditions.push(eq(invoices.status, options.status));
  }
  if (options?.paymentStatus) {
    conditions.push(eq(invoices.paymentStatus, options.paymentStatus));
  }
  if (options?.docType) {
    conditions.push(eq(invoices.docType, options.docType));
  }

  return await db
    .select({
      id: invoices.id,
      docType: invoices.docType,
      status: invoices.status,
      series: invoices.series,
      number: invoices.number,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      currency: invoices.currency,
      paymentStatus: invoices.paymentStatus,
      totals: invoices.totals,
      referencedInvoiceId: invoices.referencedInvoiceId,
      partnerName: partners.name,
      createdByName: users.name,
    })
    .from(invoices)
    .leftJoin(partners, eq(invoices.partnerId, partners.id))
    .leftJoin(users, eq(invoices.createdByUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.issueDate), desc(invoices.number))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}

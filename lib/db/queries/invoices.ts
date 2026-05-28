import { desc, and, eq } from 'drizzle-orm';
import { db } from '../drizzle';
import { users, invoices, invoiceSequences, partners } from '../schema';

// ─────────────────────────────────────────────
// INVOICE NUMBERING
// ─────────────────────────────────────────────

/**
 * Get the next available invoice number for a company + series.
 * Reads from invoiceSequences (auto-maintained by the DB trigger).
 * If no sequence row exists yet (first invoice), returns 1.
 */
export async function getNextInvoiceNumber(
  companyId: number,
  series: string = 'INV'
): Promise<number> {
  const seq = await db
    .select({ nextNumber: invoiceSequences.nextNumber })
    .from(invoiceSequences)
    .where(
      and(
        eq(invoiceSequences.companyId, companyId),
        eq(invoiceSequences.series, series)
      )
    )
    .limit(1);

  return seq[0]?.nextNumber ?? 1;
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

import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invoices, receivedInvoices } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/guards';
import { verifyCompanyAccess } from '@/lib/db/queries';

/**
 * Verify the current user has access to `companyId`. Throws otherwise.
 *
 * Each query here re-checks rather than trusting the caller. Defense in
 * depth: if `getCompanyMetrics(123)` were ever called from a page that
 * forgot to verify access, the throw would surface immediately instead
 * of silently leaking aggregate data from another company.
 */
async function ensureCompanyAccess(companyId: number): Promise<void> {
  const user = await requireUser();
  const membership = await verifyCompanyAccess(user.id, companyId);
  if (!membership) throw new Error('No access to this company');
}

export interface CompanyMetrics {
  revenue: number;
  outstanding: number;
  invoiceCountThisMonth: number;
  overdueCount: number;
  totalInvoices: number;
  draftCount: number;
  finalizedCount: number;
  creditNotes: number;
  debitNotes: number;
}

export async function getCompanyMetrics(companyId: number): Promise<CompanyMetrics> {
  await ensureCompanyAccess(companyId);
  const [row] = await db
    .select({
      revenue: sql<string>`coalesce(sum(
        case when ${invoices.docType} = 'invoice'
             and ${invoices.status} = 'finalized'
             and ${invoices.paymentStatus} = 'paid'
        then (${invoices.totals}->>'grossAmount')::numeric else 0 end
      ), 0)`,
      outstanding: sql<string>`coalesce(sum(
        case when ${invoices.docType} = 'invoice'
             and ${invoices.status} = 'finalized'
             and ${invoices.paymentStatus} = 'unpaid'
        then (${invoices.totals}->>'grossAmount')::numeric else 0 end
      ), 0)`,
      invoiceCountThisMonth: sql<number>`count(*) filter (
        where ${invoices.docType} = 'invoice'
          and date_trunc('month', ${invoices.issueDate}::timestamp) = date_trunc('month', now())
      )`,
      overdueCount: sql<number>`count(*) filter (
        where ${invoices.docType} = 'invoice'
          and ${invoices.status} = 'finalized'
          and ${invoices.paymentStatus} = 'unpaid'
          and ${invoices.dueDate}::date < current_date
      )`,
      totalInvoices: sql<number>`count(*) filter (where ${invoices.docType} = 'invoice')`,
      draftCount: sql<number>`count(*) filter (
        where ${invoices.docType} = 'invoice' and ${invoices.status} = 'draft'
      )`,
      finalizedCount: sql<number>`count(*) filter (
        where ${invoices.docType} = 'invoice' and ${invoices.status} = 'finalized'
      )`,
      creditNotes: sql<number>`count(*) filter (where ${invoices.docType} = 'credit_note')`,
      debitNotes: sql<number>`count(*) filter (where ${invoices.docType} = 'debit_note')`,
    })
    .from(invoices)
    .where(eq(invoices.companyId, companyId));

  return {
    revenue: parseFloat(row.revenue),
    outstanding: parseFloat(row.outstanding),
    invoiceCountThisMonth: row.invoiceCountThisMonth,
    overdueCount: row.overdueCount,
    totalInvoices: row.totalInvoices,
    draftCount: row.draftCount,
    finalizedCount: row.finalizedCount,
    creditNotes: row.creditNotes,
    debitNotes: row.debitNotes,
  };
}

export interface CompanyExpenseMetrics {
  expensesPaid: number;
  expensesOutstanding: number;
  receivedThisMonth: number;
  pendingReviewCount: number;
  accountedCount: number;
  pendingAccountingCount: number;
}

export async function getCompanyExpenseMetrics(
  companyId: number
): Promise<CompanyExpenseMetrics> {
  await ensureCompanyAccess(companyId);
  const [row] = await db
    .select({
      expensesPaid: sql<string>`coalesce(sum(
        case when ${receivedInvoices.status} = 'confirmed'
             and ${receivedInvoices.paymentStatus} = 'paid'
        then ${receivedInvoices.grossAmount}::numeric else 0 end
      ), 0)`,
      expensesOutstanding: sql<string>`coalesce(sum(
        case when ${receivedInvoices.status} = 'confirmed'
             and ${receivedInvoices.paymentStatus} <> 'paid'
        then ${receivedInvoices.grossAmount}::numeric else 0 end
      ), 0)`,
      receivedThisMonth: sql<number>`count(*) filter (
        where ${receivedInvoices.status} = 'confirmed'
          and date_trunc('month', ${receivedInvoices.issueDate}::timestamp)
            = date_trunc('month', now())
      )`,
      pendingReviewCount: sql<number>`count(*) filter (
        where ${receivedInvoices.status} = 'draft'
      )`,
      accountedCount: sql<number>`count(*) filter (
        where ${receivedInvoices.status} = 'confirmed'
          and ${receivedInvoices.accountingStatus} = 'accounted'
      )`,
      pendingAccountingCount: sql<number>`count(*) filter (
        where ${receivedInvoices.status} = 'confirmed'
          and ${receivedInvoices.accountingStatus} = 'pending'
      )`,
    })
    .from(receivedInvoices)
    .where(
      and(
        eq(receivedInvoices.companyId, companyId),
        isNull(receivedInvoices.archivedAt)
      )
    );

  return {
    expensesPaid: parseFloat(row.expensesPaid),
    expensesOutstanding: parseFloat(row.expensesOutstanding),
    receivedThisMonth: Number(row.receivedThisMonth),
    pendingReviewCount: Number(row.pendingReviewCount),
    accountedCount: Number(row.accountedCount),
    pendingAccountingCount: Number(row.pendingAccountingCount),
  };
}

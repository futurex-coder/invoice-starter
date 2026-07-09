import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invoices, receivedInvoices, companies } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/guards';
import { verifyCompanyAccess } from '@/lib/db/queries';
import {
  collectedSumSql,
  outstandingSumSql,
  overdueCountSql,
} from '@/lib/db/queries/money';

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
      // AGG-1: signed sums — credit notes subtract, partial counts as
      // outstanding. Rules live in lib/db/queries/money.ts.
      revenue: collectedSumSql,
      outstanding: outstandingSumSql,
      invoiceCountThisMonth: sql<number>`count(*) filter (
        where ${invoices.docType} = 'invoice'
          and date_trunc('month', ${invoices.issueDate}::timestamp) = date_trunc('month', now())
      )`,
      overdueCount: overdueCountSql,
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

// ---------------------------------------------------------------------------
// TRANS-2 — "what's left this month" (shared owner ↔ accountant view)
// ---------------------------------------------------------------------------

export interface MonthCloseStatus {
  /** ISO month, e.g. "2026-07". */
  month: string;
  /** Received invoices still awaiting review (drafts block the close regardless of month). */
  pendingReviewCount: number;
  /** Finalized outgoing documents issued this month not yet booked. */
  outgoingPendingAccounting: number;
  /** Confirmed received documents issued this month not yet booked. */
  receivedPendingAccounting: number;
  /** Net VAT for the month (issued − paid; accrual) in the company base currency. */
  vatNet: number;
  /** The company base currency the figures are expressed in. */
  baseCurrency: string;
  /** True when nothing is left to review or book. */
  ready: boolean;
}

export async function getMonthCloseStatus(
  companyId: number
): Promise<MonthCloseStatus> {
  await ensureCompanyAccess(companyId);

  const monthStart = sql`date_trunc('month', CURRENT_DATE)`;

  // GEN-1: everything converts to the company base currency (× frozen fxRate),
  // so the month's VAT is a single base figure — no per-currency split.
  const [outgoing, received, co] = await Promise.all([
    db
      .select({
        pendingAccounting: sql<number>`count(*) filter (
          where ${invoices.status} = 'finalized'
            and ${invoices.docType} <> 'proforma'
            and ${invoices.accountingStatus} = 'pending'
            and ${invoices.issueDate}::date >= ${monthStart}
        )`,
        vatIssued: sql<string>`coalesce(sum(
          case when ${invoices.status} = 'finalized'
               and ${invoices.docType} <> 'proforma'
               and ${invoices.issueDate}::date >= ${monthStart}
          then (case when ${invoices.docType} = 'credit_note'
                     then -(${invoices.totals}->>'vatAmount')::numeric
                     else (${invoices.totals}->>'vatAmount')::numeric end)
               * ${invoices.fxRate}::numeric
          else 0 end
        ), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.companyId, companyId)),
    db
      .select({
        pendingReview: sql<number>`count(*) filter (
          where ${receivedInvoices.status} = 'draft'
            and ${receivedInvoices.archivedAt} is null
        )`,
        pendingAccounting: sql<number>`count(*) filter (
          where ${receivedInvoices.status} = 'confirmed'
            and ${receivedInvoices.archivedAt} is null
            and ${receivedInvoices.accountingStatus} = 'pending'
            and ${receivedInvoices.issueDate}::date >= ${monthStart}
        )`,
        vatPaid: sql<string>`coalesce(sum(
          case when ${receivedInvoices.status} = 'confirmed'
               and ${receivedInvoices.archivedAt} is null
               and ${receivedInvoices.issueDate}::date >= ${monthStart}
          then ${receivedInvoices.vatAmount}::numeric * ${receivedInvoices.fxRate}::numeric
          else 0 end
        ), 0)`,
      })
      .from(receivedInvoices)
      .where(eq(receivedInvoices.companyId, companyId)),
    db
      .select({ base: companies.defaultCurrency })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1),
  ]);

  const o = outgoing[0];
  const r = received[0];
  const baseCurrency = co[0]?.base ?? 'EUR';

  const vatIssued = o ? parseFloat(o.vatIssued) : 0;
  const vatPaid = r ? parseFloat(r.vatPaid) : 0;
  const vatNet = Math.round((vatIssued - vatPaid) * 100) / 100;

  const pendingReviewCount = r ? Number(r.pendingReview) : 0;
  const outgoingPendingAccounting = o ? Number(o.pendingAccounting) : 0;
  const receivedPendingAccounting = r ? Number(r.pendingAccounting) : 0;

  return {
    month: new Date().toISOString().slice(0, 7),
    pendingReviewCount,
    outgoingPendingAccounting,
    receivedPendingAccounting,
    vatNet,
    baseCurrency,
    ready:
      pendingReviewCount === 0 &&
      outgoingPendingAccounting === 0 &&
      receivedPendingAccounting === 0,
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
        then ${receivedInvoices.grossAmount}::numeric * ${receivedInvoices.fxRate}::numeric else 0 end
      ), 0)`,
      expensesOutstanding: sql<string>`coalesce(sum(
        case when ${receivedInvoices.status} = 'confirmed'
             and ${receivedInvoices.paymentStatus} <> 'paid'
        then ${receivedInvoices.grossAmount}::numeric * ${receivedInvoices.fxRate}::numeric else 0 end
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

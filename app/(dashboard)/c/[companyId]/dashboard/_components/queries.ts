import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invoices, receivedInvoices } from '@/lib/db/schema';
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
  /** Net VAT for the month per currency (issued − paid; accrual). */
  vatNet: { currency: string; net: number }[];
  /** True when nothing is left to review or book. */
  ready: boolean;
}

export async function getMonthCloseStatus(
  companyId: number
): Promise<MonthCloseStatus> {
  await ensureCompanyAccess(companyId);

  const monthStart = sql`date_trunc('month', CURRENT_DATE)`;

  const [outgoing, received] = await Promise.all([
    db
      .select({
        currency: invoices.currency,
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
          else 0 end
        ), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.companyId, companyId))
      .groupBy(invoices.currency),
    db
      .select({
        currency: receivedInvoices.currency,
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
          then ${receivedInvoices.vatAmount}::numeric
          else 0 end
        ), 0)`,
      })
      .from(receivedInvoices)
      .where(eq(receivedInvoices.companyId, companyId))
      .groupBy(receivedInvoices.currency),
  ]);

  const vatByCurrency = new Map<string, number>();
  for (const r of outgoing) {
    const c = r.currency ?? 'EUR';
    vatByCurrency.set(c, (vatByCurrency.get(c) ?? 0) + parseFloat(r.vatIssued));
  }
  for (const r of received) {
    const c = r.currency ?? 'EUR';
    vatByCurrency.set(c, (vatByCurrency.get(c) ?? 0) - parseFloat(r.vatPaid));
  }

  const pendingReviewCount = received.reduce(
    (a, r) => a + Number(r.pendingReview),
    0
  );
  const outgoingPendingAccounting = outgoing.reduce(
    (a, r) => a + Number(r.pendingAccounting),
    0
  );
  const receivedPendingAccounting = received.reduce(
    (a, r) => a + Number(r.pendingAccounting),
    0
  );

  return {
    month: new Date().toISOString().slice(0, 7),
    pendingReviewCount,
    outgoingPendingAccounting,
    receivedPendingAccounting,
    vatNet: [...vatByCurrency.entries()]
      .filter(([, net]) => net !== 0)
      .map(([currency, net]) => ({
        currency,
        net: Math.round(net * 100) / 100,
      }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
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

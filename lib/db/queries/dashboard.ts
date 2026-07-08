import { and, eq, isNull, sql, inArray } from 'drizzle-orm';
import { db } from '../drizzle';
import {
  companies,
  companyMembers,
  invoices,
  receivedInvoices,
} from '../schema';
import {
  collectedSumSql,
  outstandingSumSql,
  overdueCountSql,
} from './money';

// ─────────────────────────────────────────────
// DASHBOARD METRICS (CROSS-COMPANY)
// ─────────────────────────────────────────────

/**
 * Aggregated financial metrics across all of a user's companies.
 * Returns per-company breakdown + totals.
 *
 * Note: totals sum across currencies — the frontend should
 * display per-company amounts with their currency and
 * handle mixed-currency totals appropriately.
 */
export async function getDashboardMetrics(userId: number) {
  const memberships = await db
    .select({
      companyId: companyMembers.companyId,
      role: companyMembers.role,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(
      and(eq(companyMembers.userId, userId), isNull(companies.deletedAt))
    );

  const companyIds = memberships.map((m) => m.companyId);
  if (companyIds.length === 0) {
    return {
      companies: [],
      totals: {
        revenue: 0,
        outstanding: 0,
        invoiceCount: 0,
        overdueCount: 0,
        expensesPaid: 0,
        expensesOutstanding: 0,
        receivedCount: 0,
        pendingReviewCount: 0,
      },
    };
  }

  const [revenueMetrics, expenseMetrics] = await Promise.all([
    db
      .select({
        companyId: invoices.companyId,
        companyName: companies.legalName,
        currency: companies.defaultCurrency,
        // AGG-1: signed sums — credit notes subtract, partial counts as
        // outstanding. Rules live in ./money.ts.
        revenue: collectedSumSql,
        outstanding: outstandingSumSql,
        invoiceCountThisMonth: sql<number>`
          COUNT(*) FILTER (
            WHERE ${invoices.docType} = 'invoice'
              AND date_trunc('month', ${invoices.issueDate}::timestamp)
                = date_trunc('month', NOW())
          )
        `,
        overdueCount: overdueCountSql,
      })
      .from(invoices)
      .innerJoin(companies, eq(invoices.companyId, companies.id))
      .where(inArray(invoices.companyId, companyIds))
      .groupBy(
        invoices.companyId,
        companies.legalName,
        companies.defaultCurrency
      ),
    // Received-invoice (expense) aggregates: only confirmed + non-archived rows
    // count in the totals. Drafts/discarded are intentionally excluded.
    // GEN-1: amounts are converted to the company base currency via the frozen
    // fx_rate (amount_base = amount_doc × fx_rate).
    db
      .select({
        companyId: receivedInvoices.companyId,
        expensesPaid: sql<string>`
          COALESCE(SUM(
            CASE WHEN ${receivedInvoices.status} = 'confirmed'
                 AND ${receivedInvoices.archivedAt} IS NULL
                 AND ${receivedInvoices.paymentStatus} = 'paid'
            THEN ${receivedInvoices.grossAmount}::numeric * ${receivedInvoices.fxRate}::numeric
            ELSE 0 END
          ), 0)
        `,
        expensesOutstanding: sql<string>`
          COALESCE(SUM(
            CASE WHEN ${receivedInvoices.status} = 'confirmed'
                 AND ${receivedInvoices.archivedAt} IS NULL
                 AND ${receivedInvoices.paymentStatus} <> 'paid'
            THEN ${receivedInvoices.grossAmount}::numeric * ${receivedInvoices.fxRate}::numeric
            ELSE 0 END
          ), 0)
        `,
        receivedThisMonth: sql<number>`
          COUNT(*) FILTER (
            WHERE ${receivedInvoices.status} = 'confirmed'
              AND ${receivedInvoices.archivedAt} IS NULL
              AND date_trunc('month', ${receivedInvoices.issueDate}::timestamp)
                = date_trunc('month', NOW())
          )
        `,
        pendingReviewCount: sql<number>`
          COUNT(*) FILTER (
            WHERE ${receivedInvoices.status} = 'draft'
              AND ${receivedInvoices.archivedAt} IS NULL
          )
        `,
      })
      .from(receivedInvoices)
      .where(inArray(receivedInvoices.companyId, companyIds))
      .groupBy(receivedInvoices.companyId),
  ]);

  const expenseByCompany = new Map<
    number,
    {
      expensesPaid: number;
      expensesOutstanding: number;
      receivedThisMonth: number;
      pendingReviewCount: number;
    }
  >();
  for (const e of expenseMetrics) {
    expenseByCompany.set(e.companyId, {
      expensesPaid: parseFloat(e.expensesPaid),
      expensesOutstanding: parseFloat(e.expensesOutstanding),
      receivedThisMonth: Number(e.receivedThisMonth),
      pendingReviewCount: Number(e.pendingReviewCount),
    });
  }

  // Some companies may have only expenses (no revenue) — make sure they show.
  const seenCompanyIds = new Set(revenueMetrics.map((m) => m.companyId));
  const missingCompanyRows: typeof revenueMetrics = [];
  if (expenseByCompany.size > 0) {
    const orphanIds = [...expenseByCompany.keys()].filter(
      (id) => !seenCompanyIds.has(id)
    );
    if (orphanIds.length > 0) {
      const rows = await db
        .select({
          id: companies.id,
          legalName: companies.legalName,
          defaultCurrency: companies.defaultCurrency,
        })
        .from(companies)
        .where(inArray(companies.id, orphanIds));
      for (const r of rows) {
        missingCompanyRows.push({
          companyId: r.id,
          companyName: r.legalName,
          currency: r.defaultCurrency,
          revenue: '0',
          outstanding: '0',
          invoiceCountThisMonth: 0,
          overdueCount: 0,
        });
      }
    }
  }

  const allRevenueRows = [...revenueMetrics, ...missingCompanyRows];

  const companyMetrics = allRevenueRows.map((m) => {
    const exp = expenseByCompany.get(m.companyId) ?? {
      expensesPaid: 0,
      expensesOutstanding: 0,
      receivedThisMonth: 0,
      pendingReviewCount: 0,
    };
    return {
      ...m,
      revenue: parseFloat(m.revenue),
      outstanding: parseFloat(m.outstanding),
      invoiceCountThisMonth: Number(m.invoiceCountThisMonth),
      overdueCount: Number(m.overdueCount),
      expensesPaid: exp.expensesPaid,
      expensesOutstanding: exp.expensesOutstanding,
      receivedThisMonth: exp.receivedThisMonth,
      pendingReviewCount: exp.pendingReviewCount,
      role:
        memberships.find((mem) => mem.companyId === m.companyId)?.role ??
        'unknown',
    };
  });

  const totals = companyMetrics.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      outstanding: acc.outstanding + m.outstanding,
      invoiceCount: acc.invoiceCount + m.invoiceCountThisMonth,
      overdueCount: acc.overdueCount + m.overdueCount,
      expensesPaid: acc.expensesPaid + m.expensesPaid,
      expensesOutstanding: acc.expensesOutstanding + m.expensesOutstanding,
      receivedCount: acc.receivedCount + m.receivedThisMonth,
      pendingReviewCount: acc.pendingReviewCount + m.pendingReviewCount,
    }),
    {
      revenue: 0,
      outstanding: 0,
      invoiceCount: 0,
      overdueCount: 0,
      expensesPaid: 0,
      expensesOutstanding: 0,
      receivedCount: 0,
      pendingReviewCount: 0,
    }
  );

  return { companies: companyMetrics, totals };
}

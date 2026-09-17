import { and, eq, desc, sql, gte, lte, or } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invoices } from '@/lib/db/schema';
import { parseInvoiceRow } from './parsers';
import type { ListInvoicesFilters, ListInvoicesResult } from './actions';

/**
 * Core invoice-list query, keyed by an explicit `companyId`.
 *
 * Extracted from the `listInvoices` server action so it can be called two ways
 * with identical output shape:
 *   - the action (`listInvoices`) — companyId from the active-company cookie;
 *   - the server component (`invoices/page.tsx`) — companyId from the URL, to
 *     SSR-seed the SWR cache (see PERFORMANCE_AUDIT_ROUND2.md, T2). Seeding by
 *     the URL id (not the cookie) avoids a cross-company mismatch on direct
 *     navigation when `revalidateIfStale` is off.
 */
export async function queryInvoicesList(
  companyId: number,
  filters: ListInvoicesFilters = {}
): Promise<ListInvoicesResult> {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 20, 100);
  const offset = (page - 1) * pageSize;

  const conditions = [eq(invoices.companyId, companyId)];

  if (filters.status) {
    conditions.push(eq(invoices.status, filters.status));
  }
  if (filters.docType) {
    conditions.push(eq(invoices.docType, filters.docType));
  }
  if (filters.paymentStatus) {
    conditions.push(eq(invoices.paymentStatus, filters.paymentStatus));
  }
  if (filters.accountingStatus) {
    conditions.push(eq(invoices.accountingStatus, filters.accountingStatus));
  }
  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    conditions.push(
      sql`date_trunc('month', ${invoices.issueDate}::date) = ${`${filters.month}-01`}::date`
    );
  }
  if (filters.dateFrom) {
    conditions.push(gte(invoices.issueDate, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(invoices.issueDate, filters.dateTo));
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    const searchCond = or(
      sql`${invoices.number}::text LIKE ${term}`,
      sql`${invoices.recipientSnapshot}->>'legalName' ILIKE ${term}`,
      sql`EXISTS (SELECT 1 FROM partners p WHERE p.id = ${invoices.partnerId} AND (p.name ILIKE ${term} OR p.eik LIKE ${term}))`
    );
    if (searchCond) conditions.push(searchCond);
  }

  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(invoices)
      .where(where)
      .orderBy(desc(invoices.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(where),
  ]);

  return {
    invoices: rows.map(parseInvoiceRow),
    total: countResult[0]?.count ?? 0,
    page,
    pageSize,
  };
}

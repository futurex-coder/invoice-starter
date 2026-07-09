import { and, eq, desc, sql, isNull, ne, gte, lte } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { receivedInvoices, partners } from '@/lib/db/schema';
import {
  parseAccountingStatus,
  parseLifecycleStatus,
  parsePaymentStatus,
  parseSupplierSnapshot,
} from './parsers';
import type {
  ListReceivedInvoicesFilters,
  ReceivedInvoiceListItem,
} from './actions';

export interface ReceivedInvoicesListSlice {
  items: ReceivedInvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
}

/**
 * Core received-invoice list query, keyed by an explicit companyId. Shared by
 * the `listReceivedInvoices` action (companyId from cookie) and the SSR seed in
 * received-invoices/page.tsx (companyId from URL). See PERFORMANCE_AUDIT_ROUND2.
 */
export async function queryReceivedInvoicesList(
  companyId: number,
  filters: ListReceivedInvoicesFilters = {}
): Promise<ReceivedInvoicesListSlice> {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 20, 100);
  const offset = (page - 1) * pageSize;

  const conditions = [eq(receivedInvoices.companyId, companyId)];

  if (filters.status) {
    conditions.push(eq(receivedInvoices.status, filters.status));
  } else {
    // Default "working set" view: show analyzing / failed / draft / confirmed,
    // hide only discarded (reachable via the explicit Discarded filter).
    conditions.push(ne(receivedInvoices.status, 'discarded'));
  }
  if (filters.accountingStatus) {
    conditions.push(
      eq(receivedInvoices.accountingStatus, filters.accountingStatus)
    );
  }
  if (filters.paymentStatus) {
    conditions.push(eq(receivedInvoices.paymentStatus, filters.paymentStatus));
  }
  if (!filters.includeArchived) {
    conditions.push(isNull(receivedInvoices.archivedAt));
  }
  if (filters.dateFrom) {
    conditions.push(gte(receivedInvoices.issueDate, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(receivedInvoices.issueDate, filters.dateTo));
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      sql`(
        ${receivedInvoices.invoiceNumber} ILIKE ${term}
        OR ${receivedInvoices.supplierSnapshot}->>'legalName' ILIKE ${term}
        OR EXISTS (
          SELECT 1 FROM partners p
          WHERE p.id = ${receivedInvoices.partnerId}
            AND (p.name ILIKE ${term} OR p.eik LIKE ${term})
        )
      )`
    );
  }

  const where = and(...conditions);

  const [rows, countResult, pendingResult] = await Promise.all([
    db
      .select({
        id: receivedInvoices.id,
        status: receivedInvoices.status,
        accountingStatus: receivedInvoices.accountingStatus,
        paymentStatus: receivedInvoices.paymentStatus,
        archivedAt: receivedInvoices.archivedAt,
        invoiceNumber: receivedInvoices.invoiceNumber,
        issueDate: receivedInvoices.issueDate,
        dueDate: receivedInvoices.dueDate,
        currency: receivedInvoices.currency,
        grossAmount: receivedInvoices.grossAmount,
        partnerId: receivedInvoices.partnerId,
        partnerName: partners.name,
        supplierSnapshot: receivedInvoices.supplierSnapshot,
        extractionConfidence: receivedInvoices.extractionConfidence,
        fileMimeType: receivedInvoices.fileMimeType,
        createdAt: receivedInvoices.createdAt,
      })
      .from(receivedInvoices)
      .leftJoin(partners, eq(receivedInvoices.partnerId, partners.id))
      .where(where)
      .orderBy(desc(receivedInvoices.createdAt))
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(receivedInvoices)
      .where(where),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.companyId, companyId),
          eq(receivedInvoices.status, 'draft')
        )
      ),
  ]);

  const items: ReceivedInvoiceListItem[] = rows.map((r) => ({
    ...r,
    status: parseLifecycleStatus(r.status),
    accountingStatus: parseAccountingStatus(r.accountingStatus),
    paymentStatus: parsePaymentStatus(r.paymentStatus),
    supplierSnapshot: parseSupplierSnapshot(r.supplierSnapshot),
  }));

  return {
    items,
    total: countResult[0]?.count ?? 0,
    pendingCount: pendingResult[0]?.count ?? 0,
    page,
    pageSize,
  };
}

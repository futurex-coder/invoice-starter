import { and, eq, or, ilike, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { partners, articles, type Partner, type Article } from '@/lib/db/schema';

// Shared list queries keyed by an explicit companyId, so the server actions
// (companyId from cookie) and the server page components (companyId from URL,
// for SSR seeding — see PERFORMANCE_AUDIT_ROUND2.md T2) return an identical
// shape. Structurally compatible with ListResult<T> in ./actions.
interface ListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}
interface ListSlice<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function queryPartnersList(
  companyId: number,
  { page = 1, pageSize = 20, search }: ListParams = {}
): Promise<ListSlice<Partner>> {
  const offset = (page - 1) * pageSize;
  const conditions = [eq(partners.companyId, companyId)];
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const trimmed = search.trim();
    conditions.push(or(ilike(partners.name, term), eq(partners.eik, trimmed))!);
  }
  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(partners)
      .where(where)
      .orderBy(desc(partners.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(partners).where(where),
  ]);

  return { items: rows, total: countResult[0]?.count ?? 0, page, pageSize };
}

export async function queryArticlesList(
  companyId: number,
  { page = 1, pageSize = 20, search }: ListParams = {}
): Promise<ListSlice<Article>> {
  const offset = (page - 1) * pageSize;
  const conditions = [eq(articles.companyId, companyId)];
  if (search && search.trim()) {
    conditions.push(ilike(articles.name, `%${search.trim()}%`));
  }
  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(where)
      .orderBy(desc(articles.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(articles).where(where),
  ]);

  return { items: rows, total: countResult[0]?.count ?? 0, page, pageSize };
}

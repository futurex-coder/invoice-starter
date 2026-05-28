import { eq } from 'drizzle-orm';
import { db } from '../drizzle';
import { articles } from '../schema';

/**
 * Get articles for a specific company.
 */
export async function getArticlesForCompany(companyId: number) {
  return await db
    .select()
    .from(articles)
    .where(eq(articles.companyId, companyId))
    .orderBy(articles.name);
}

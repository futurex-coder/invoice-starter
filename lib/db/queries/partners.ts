import { eq } from 'drizzle-orm';
import { db } from '../drizzle';
import { partners } from '../schema';

/**
 * Get partners for a specific company.
 */
export async function getPartnersForCompany(companyId: number) {
  return await db
    .select({
      id: partners.id,
      name: partners.name,
      eik: partners.eik,
      vatNumber: partners.vatNumber,
      city: partners.city,
      linkedCompanyId: partners.linkedCompanyId,
      isIndividual: partners.isIndividual,
    })
    .from(partners)
    .where(eq(partners.companyId, companyId))
    .orderBy(partners.name);
}

import { getUser, getCompaniesForUser } from '@/lib/db/queries';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json(null);
  }
  // TODO: Replace with proper /api/company/[companyId] route after route restructuring
  const companies = await getCompaniesForUser(user.id);
  const firstCompany = companies[0]?.company ?? null;
  return Response.json(firstCompany);
}

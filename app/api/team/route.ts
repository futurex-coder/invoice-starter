import { getUser, getCompaniesForUser } from '@/lib/db/queries';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ memberships: [] }, { status: 401 });
  }
  const memberships = await getCompaniesForUser(user.id);
  return Response.json({ memberships });
}

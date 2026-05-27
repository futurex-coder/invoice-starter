import { getSafeUser } from '@/lib/db/queries';

export async function GET() {
  const user = await getSafeUser();
  return Response.json(user);
}

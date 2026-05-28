import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../drizzle';
import { users, type SafeUser } from '../schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

// ─────────────────────────────────────────────
// AUTH & SESSION
// ─────────────────────────────────────────────

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

/**
 * Like {@link getUser}, but strips the `passwordHash` field.
 * Use this anywhere user data crosses the network boundary
 * (API routes, server-component → client props).
 */
export async function getSafeUser(): Promise<SafeUser | null> {
  const user = await getUser();
  if (!user) return null;
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

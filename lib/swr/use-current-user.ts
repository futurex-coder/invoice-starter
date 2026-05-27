'use client';

import useSWR from 'swr';
import type { SafeUser } from '@/lib/db/schema';

const fetcher = (url: string): Promise<SafeUser | null> =>
  fetch(url).then((res) => res.json());

/**
 * Reads the current user from `/api/user`.
 *
 * Replaces the 4-place duplicate `useSWR<SafeUser>('/api/user', fetcher)` +
 * locally-defined `fetcher` pattern. Returns SWR's full hook result so
 * consumers can also access `isLoading`, `mutate`, `error`, etc.
 *
 * @example
 *   const { data: user } = useCurrentUser();
 *   if (!user) return null;
 *   return <p>Hi, {user.email}</p>;
 */
export function useCurrentUser() {
  return useSWR<SafeUser | null>('/api/user', fetcher);
}

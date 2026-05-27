'use client';

import useSWR, { type SWRConfiguration, type SWRResponse, type Key } from 'swr';
import type { ActionResult } from '@/lib/actions/result';

/**
 * SWR wrapper for server actions that return `{ data?, error? }`.
 *
 * Adapts the action's `error` string into a thrown Error so SWR's `error`
 * field catches it. On success, `data` is unwrapped to the action's payload.
 *
 * Pass `null` as the key to defer the fetch (SWR convention).
 */
export function useActionSWR<T>(
  key: Key,
  action: () => Promise<ActionResult<T>>,
  config?: SWRConfiguration<T | undefined, Error>
): SWRResponse<T | undefined, Error> {
  return useSWR<T | undefined, Error>(
    key,
    async () => {
      const res = await action();
      if (res.error) throw new Error(res.error);
      return res.data;
    },
    config
  );
}

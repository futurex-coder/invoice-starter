/**
 * Centralized activity-log writer.
 *
 * Replaces three duplicate per-feature `logActivity` helpers and one
 * `logInvoiceActivity` that all wrote the same row to `activityLogs` with
 * subtly different signatures (one took `action: string`, which lost
 * compile-time enum enforcement and let buggy literals like
 * `'partner.create'` slip into production rows — those rendered as
 * "Unknown action" in the feed).
 *
 * This module is the only place `db.insert(activityLogs)` should be called.
 * The `type: ActivityType` argument is exhaustively typed — adding a new
 * activity kind requires editing both `ActivityType` in `schema.ts` AND
 * `ACTIVITY_LABELS` in `@/lib/activity-labels.ts` (the typed `Record`
 * forces it).
 */

import { db } from './drizzle';
import { activityLogs, type ActivityType } from './schema';

/** Drizzle transaction handle as exposed inside `db.transaction(async (tx) => {...})`. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Append an activity-log row. Pass `companyId: null` for early-lifecycle
 * actions that fire before a user belongs to a company (e.g. `SIGN_UP`) —
 * the write is silently skipped in that case so callers don't need their
 * own guard.
 */
export async function logActivity(
  companyId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
): Promise<void> {
  if (companyId === null || companyId === undefined) return;
  await db.insert(activityLogs).values({
    companyId,
    userId,
    action: type,
    ipAddress: ipAddress ?? '',
  });
}

/**
 * Transaction-aware variant. Use inside `db.transaction(async (tx) => {...})`
 * so the activity row commits/rolls back atomically with the surrounding work.
 *
 * Unlike {@link logActivity}, `companyId` is non-nullable — actions that run
 * inside a transaction always know which company they're operating on.
 */
export async function logActivityInTx(
  tx: Tx,
  companyId: number,
  userId: number,
  type: ActivityType,
  ipAddress?: string
): Promise<void> {
  await tx.insert(activityLogs).values({
    companyId,
    userId,
    action: type,
    ipAddress: ipAddress ?? '',
  });
}

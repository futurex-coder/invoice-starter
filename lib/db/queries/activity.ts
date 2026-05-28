import { desc, and, eq, isNull, inArray } from 'drizzle-orm';
import { db } from '../drizzle';
import { users, companies, companyMembers, activityLogs } from '../schema';

// ─────────────────────────────────────────────
// ACTIVITY LOGS
// ─────────────────────────────────────────────

/**
 * Get activity logs for a specific company.
 * If onlyUserId is provided, filters to that user's actions only.
 */
export async function getActivityLogs(
  companyId: number,
  options?: {
    onlyUserId?: number;
    limit?: number;
  }
) {
  const conditions = [eq(activityLogs.companyId, companyId)];

  if (options?.onlyUserId) {
    conditions.push(eq(activityLogs.userId, options.onlyUserId));
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
      userId: users.id,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(activityLogs.timestamp))
    .limit(options?.limit ?? 20);
}

/**
 * Get recent activity across ALL of a user's companies.
 * Used for the cross-company dashboard.
 * onlyOwnActions: true = see only your actions (default for accountants).
 * onlyOwnActions: false = see all activity (toggle for owners).
 */
export async function getActivityLogsForDashboard(
  userId: number,
  options?: {
    onlyOwnActions?: boolean;
    limit?: number;
  }
) {
  const memberships = await db
    .select({ companyId: companyMembers.companyId })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(
      and(eq(companyMembers.userId, userId), isNull(companies.deletedAt))
    );

  const companyIds = memberships.map((m) => m.companyId);
  if (companyIds.length === 0) return [];

  const conditions = [inArray(activityLogs.companyId, companyIds)];

  if (options?.onlyOwnActions) {
    conditions.push(eq(activityLogs.userId, userId));
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
      userId: users.id,
      companyId: activityLogs.companyId,
      companyName: companies.legalName,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .innerJoin(companies, eq(activityLogs.companyId, companies.id))
    .where(and(...conditions))
    .orderBy(desc(activityLogs.timestamp))
    .limit(options?.limit ?? 20);
}

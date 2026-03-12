import { desc, and, eq, isNull, sql, inArray } from 'drizzle-orm';
import { db } from './drizzle';
import {
  users,
  companies,
  companyMembers,
  activityLogs,
  invitations,
  invoices,
  invoiceSequences,
  partners,
  articles,
  CompanyRole,
  type UserCompanyMembership,
} from './schema';
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

// ─────────────────────────────────────────────
// ACTIVE COMPANY CONTEXT
// ─────────────────────────────────────────────

/**
 * Read the active company ID from the cookie.
 * Returns null if not set — callers should redirect to company picker.
 */
export async function getActiveCompanyId(): Promise<number | null> {
  const cookie = (await cookies()).get('activeCompanyId');
  if (!cookie?.value) return null;
  const id = parseInt(cookie.value, 10);
  return isNaN(id) ? null : id;
}

/**
 * Verify that the current user has access to a specific company.
 * Returns the membership row (with role) or null if no access.
 */
export async function verifyCompanyAccess(
  userId: number,
  companyId: number
) {
  const membership = await db
    .select({
      id: companyMembers.id,
      role: companyMembers.role,
      companyId: companyMembers.companyId,
      userId: companyMembers.userId,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(
      and(
        eq(companyMembers.userId, userId),
        eq(companyMembers.companyId, companyId),
        isNull(companies.deletedAt)
      )
    )
    .limit(1);

  return membership[0] ?? null;
}

/**
 * Verify access and check for a specific role (e.g. 'owner').
 */
export async function verifyCompanyRole(
  userId: number,
  companyId: number,
  requiredRole: CompanyRole
) {
  const membership = await verifyCompanyAccess(userId, companyId);
  if (!membership) return null;
  if (membership.role !== requiredRole) return null;
  return membership;
}

// ─────────────────────────────────────────────
// COMPANY QUERIES
// ─────────────────────────────────────────────

/**
 * Get all companies for a user with their role in each.
 * Used for the impersonation dropdown.
 * Excludes soft-deleted companies.
 */
export async function getCompaniesForUser(
  userId: number
): Promise<UserCompanyMembership[]> {
  const rows = await db
    .select({
      company: companies,
      role: companyMembers.role,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(
      and(eq(companyMembers.userId, userId), isNull(companies.deletedAt))
    )
    .orderBy(companies.legalName);

  return rows;
}

/**
 * Get a single company with its members and pending invitations.
 * Used for the company settings / members page.
 */
export async function getCompanyWithMembers(companyId: number) {
  const result = await db.query.companies.findFirst({
    where: and(eq(companies.id, companyId), isNull(companies.deletedAt)),
    with: {
      members: {
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      invitations: {
        where: eq(invitations.status, 'pending'),
      },
    },
  });

  return result ?? null;
}

/**
 * Check if an EIK already exists among active companies.
 * Used during company creation to enforce the block rule.
 */
export async function findCompanyByEik(eik: string) {
  const result = await db
    .select()
    .from(companies)
    .where(and(eq(companies.eik, eik), isNull(companies.deletedAt)))
    .limit(1);

  return result[0] ?? null;
}

// ─────────────────────────────────────────────
// STRIPE (PER-USER BILLING)
// ─────────────────────────────────────────────

export async function getUserByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  return result[0] ?? null;
}

export async function updateUserSubscription(
  userId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(users)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

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

// ─────────────────────────────────────────────
// INVOICE NUMBERING
// ─────────────────────────────────────────────

/**
 * Get the next available invoice number for a company + series.
 * Reads from invoiceSequences (auto-maintained by the DB trigger).
 * If no sequence row exists yet (first invoice), returns 1.
 */
export async function getNextInvoiceNumber(
  companyId: number,
  series: string = 'INV'
): Promise<number> {
  const seq = await db
    .select({ nextNumber: invoiceSequences.nextNumber })
    .from(invoiceSequences)
    .where(
      and(
        eq(invoiceSequences.companyId, companyId),
        eq(invoiceSequences.series, series)
      )
    )
    .limit(1);

  return seq[0]?.nextNumber ?? 1;
}

// ─────────────────────────────────────────────
// DASHBOARD METRICS (CROSS-COMPANY)
// ─────────────────────────────────────────────

/**
 * Aggregated financial metrics across all of a user's companies.
 * Returns per-company breakdown + totals.
 *
 * Note: totals sum across currencies — the frontend should
 * display per-company amounts with their currency and
 * handle mixed-currency totals appropriately.
 */
export async function getDashboardMetrics(userId: number) {
  const memberships = await db
    .select({
      companyId: companyMembers.companyId,
      role: companyMembers.role,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(
      and(eq(companyMembers.userId, userId), isNull(companies.deletedAt))
    );

  const companyIds = memberships.map((m) => m.companyId);
  if (companyIds.length === 0) {
    return {
      companies: [],
      totals: {
        revenue: 0,
        outstanding: 0,
        invoiceCount: 0,
        overdueCount: 0,
      },
    };
  }

  const metrics = await db
    .select({
      companyId: invoices.companyId,
      companyName: companies.legalName,
      currency: companies.defaultCurrency,
      revenue: sql<string>`
        COALESCE(SUM(
          CASE WHEN ${invoices.docType} = 'invoice'
               AND ${invoices.status} = 'finalized'
               AND ${invoices.paymentStatus} = 'paid'
          THEN (${invoices.totals}->>'grossAmount')::numeric
          ELSE 0 END
        ), 0)
      `,
      outstanding: sql<string>`
        COALESCE(SUM(
          CASE WHEN ${invoices.docType} = 'invoice'
               AND ${invoices.status} = 'finalized'
               AND ${invoices.paymentStatus} = 'unpaid'
          THEN (${invoices.totals}->>'grossAmount')::numeric
          ELSE 0 END
        ), 0)
      `,
      invoiceCountThisMonth: sql<number>`
        COUNT(*) FILTER (
          WHERE ${invoices.docType} = 'invoice'
            AND date_trunc('month', ${invoices.issueDate}::timestamp)
              = date_trunc('month', NOW())
        )
      `,
      overdueCount: sql<number>`
        COUNT(*) FILTER (
          WHERE ${invoices.docType} = 'invoice'
            AND ${invoices.status} = 'finalized'
            AND ${invoices.paymentStatus} = 'unpaid'
            AND ${invoices.dueDate}::date < CURRENT_DATE
        )
      `,
    })
    .from(invoices)
    .innerJoin(companies, eq(invoices.companyId, companies.id))
    .where(inArray(invoices.companyId, companyIds))
    .groupBy(
      invoices.companyId,
      companies.legalName,
      companies.defaultCurrency
    );

  const companyMetrics = metrics.map((m) => ({
    ...m,
    revenue: parseFloat(m.revenue),
    outstanding: parseFloat(m.outstanding),
    role:
      memberships.find((mem) => mem.companyId === m.companyId)?.role ??
      'unknown',
  }));

  const totals = companyMetrics.reduce(
    (acc, m) => ({
      revenue: acc.revenue + m.revenue,
      outstanding: acc.outstanding + m.outstanding,
      invoiceCount: acc.invoiceCount + m.invoiceCountThisMonth,
      overdueCount: acc.overdueCount + m.overdueCount,
    }),
    { revenue: 0, outstanding: 0, invoiceCount: 0, overdueCount: 0 }
  );

  return { companies: companyMetrics, totals };
}

// ─────────────────────────────────────────────
// COMPANY-SCOPED DATA QUERIES
// ─────────────────────────────────────────────

/**
 * Get invoices for a specific company with optional filters.
 */
export async function getInvoicesForCompany(
  companyId: number,
  options?: {
    status?: string;
    paymentStatus?: string;
    docType?: string;
    limit?: number;
    offset?: number;
  }
) {
  const conditions = [eq(invoices.companyId, companyId)];

  if (options?.status) {
    conditions.push(eq(invoices.status, options.status));
  }
  if (options?.paymentStatus) {
    conditions.push(eq(invoices.paymentStatus, options.paymentStatus));
  }
  if (options?.docType) {
    conditions.push(eq(invoices.docType, options.docType));
  }

  return await db
    .select({
      id: invoices.id,
      docType: invoices.docType,
      status: invoices.status,
      series: invoices.series,
      number: invoices.number,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      currency: invoices.currency,
      paymentStatus: invoices.paymentStatus,
      totals: invoices.totals,
      referencedInvoiceId: invoices.referencedInvoiceId,
      partnerName: partners.name,
      createdByName: users.name,
    })
    .from(invoices)
    .leftJoin(partners, eq(invoices.partnerId, partners.id))
    .leftJoin(users, eq(invoices.createdByUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.issueDate), desc(invoices.number))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}

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

// ─────────────────────────────────────────────
// OWNERSHIP TRANSFER
// ─────────────────────────────────────────────

/**
 * Transfer company ownership from current owner to another member.
 * Old owner becomes accountant. Runs in a transaction to satisfy
 * the partial unique constraint (one owner at a time).
 */
export async function transferCompanyOwnership(
  companyId: number,
  currentOwnerId: number,
  newOwnerId: number
) {
  return await db.transaction(async (tx) => {
    // Verify current owner
    const currentOwner = await tx
      .select()
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.companyId, companyId),
          eq(companyMembers.userId, currentOwnerId),
          eq(companyMembers.role, CompanyRole.OWNER)
        )
      )
      .limit(1);

    if (currentOwner.length === 0) {
      throw new Error('Current user is not the owner of this company');
    }

    // Verify new owner is a member
    const newOwnerMembership = await tx
      .select()
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.companyId, companyId),
          eq(companyMembers.userId, newOwnerId)
        )
      )
      .limit(1);

    if (newOwnerMembership.length === 0) {
      throw new Error('Target user is not a member of this company');
    }

    // Demote current owner FIRST (to avoid unique constraint violation)
    await tx
      .update(companyMembers)
      .set({ role: CompanyRole.ACCOUNTANT })
      .where(eq(companyMembers.id, currentOwner[0].id));

    // Promote new owner
    await tx
      .update(companyMembers)
      .set({ role: CompanyRole.OWNER })
      .where(eq(companyMembers.id, newOwnerMembership[0].id));

    return { success: true };
  });
}

// ─────────────────────────────────────────────
// SOFT DELETE & RESTORE
// ─────────────────────────────────────────────

/**
 * Soft-delete a company. Only the owner should call this (enforce in route).
 * Company members stay intact for potential restoration.
 */
export async function softDeleteCompany(companyId: number) {
  await db
    .update(companies)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(companies.id, companyId));
}

/**
 * Restore a soft-deleted company.
 * Caller must verify they were the owner before deletion.
 */
export async function restoreCompany(companyId: number) {
  await db
    .update(companies)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(companies.id, companyId));
}

/**
 * Get soft-deleted companies where the user was an owner.
 * Used for the "restore company" flow.
 */
export async function getDeletedCompaniesForUser(userId: number) {
  return await db
    .select({
      company: companies,
      role: companyMembers.role,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companyMembers.companyId, companies.id))
    .where(
      and(
        eq(companyMembers.userId, userId),
        eq(companyMembers.role, CompanyRole.OWNER),
        sql`${companies.deletedAt} IS NOT NULL`
      )
    )
    .orderBy(desc(companies.deletedAt));
}

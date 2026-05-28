import { desc, and, eq, isNull, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { db } from '../drizzle';
import {
  companies,
  companyMembers,
  invitations,
  CompanyRole,
  type UserCompanyMembership,
} from '../schema';

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

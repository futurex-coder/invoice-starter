/**
 * Auth guards used by server actions, server components, and API routes.
 *
 * See ADR-0001 (docs/adr/0001-unified-action-and-auth-contract.md).
 *
 * - {@link requireUser}             — for server actions wrapped in `action()`. Throws.
 * - {@link requireUserOrRedirect}   — for server components. Redirects to /sign-in.
 * - {@link requireCompanyAccess}    — for server actions. Throws on any failure.
 * - {@link withApiAuth}             — for API route handlers. Returns 401 JSON.
 * - {@link withApiCompanyAuth}      — for API routes needing company context. 401 / 403.
 */

import { redirect } from 'next/navigation';
import { NextRequest, NextResponse } from 'next/server';
import {
  getUser,
  getActiveCompanyId,
  verifyCompanyAccess,
} from '@/lib/db/queries';
import { CompanyRole, type User } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Role narrowing
// ---------------------------------------------------------------------------
// `companyMembers.role` is stored as `varchar(50)` with no DB-level enum
// constraint, so Drizzle infers it as `string`. Narrow it here so callers
// receive the proper `CompanyRole` union — and throw loudly if the DB ever
// contains a value that's not in the enum (defensive against drift).

const COMPANY_ROLES: ReadonlySet<string> = new Set(Object.values(CompanyRole));

function isCompanyRole(s: string): s is CompanyRole {
  return COMPANY_ROLES.has(s);
}

// ---------------------------------------------------------------------------
// Server-action / server-component guards
// ---------------------------------------------------------------------------

/**
 * Resolve the current user or throw `"Not authenticated"`.
 *
 * Designed for server actions wrapped by {@link action} — the throw is caught
 * and converted into `{ error: 'Not authenticated' }` for the client.
 */
export async function requireUser(): Promise<User> {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  return user;
}

/**
 * Resolve the current user, or redirect to `/sign-in` if there's no session.
 *
 * Designed for server components. `redirect()` throws a `NEXT_REDIRECT`
 * internally — TS narrows `user` to `User` after the guard.
 */
export async function requireUserOrRedirect(): Promise<User> {
  const user = await getUser();
  if (!user) redirect('/sign-in');
  return user;
}

export type CompanyAccessContext = {
  user: User;
  companyId: number;
  role: CompanyRole;
};

/**
 * Resolve the active-company context, or throw with a specific reason:
 *   - `"Not authenticated"`      — no session
 *   - `"No active company selected"` — session ok but no company cookie
 *   - `"No access to this company"`  — cookie set but user has no membership
 *
 * Designed for server actions wrapped by {@link action}. The thrown error
 * becomes the canonical `{ error }` response shape.
 */
export async function requireCompanyAccess(): Promise<CompanyAccessContext> {
  const user = await requireUser();
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No active company selected');
  const membership = await verifyCompanyAccess(user.id, companyId);
  if (!membership) throw new Error('No access to this company');
  if (!isCompanyRole(membership.role)) {
    throw new Error(`Invalid role stored for membership: ${membership.role}`);
  }
  return { user, companyId, role: membership.role };
}

// ---------------------------------------------------------------------------
// API-route wrappers
// ---------------------------------------------------------------------------

type ApiErrorBody = { error: string };

type ApiHandler<T> = (
  user: User,
  req: NextRequest
) => Promise<NextResponse<T>>;

type ApiAuthHandler<T> = (
  req: NextRequest
) => Promise<NextResponse<T> | NextResponse<ApiErrorBody>>;

/**
 * Wrap a Next.js route handler with a session check.
 * Returns 401 JSON (`{ error: 'Unauthorized' }`) if no session; otherwise
 * delegates to `handler` with the resolved `user`.
 *
 * @example
 *   export const POST = withApiAuth(async (user, req) => {
 *     const body = await req.json();
 *     return NextResponse.json({ data: { greeting: `hi ${user.email}` } });
 *   });
 */
export function withApiAuth<T>(handler: ApiHandler<T>): ApiAuthHandler<T> {
  return async (req: NextRequest) => {
    const user = await getUser();
    if (!user) {
      return NextResponse.json<ApiErrorBody>(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    return handler(user, req);
  };
}

type ApiCompanyHandler<T> = (
  ctx: CompanyAccessContext,
  req: NextRequest
) => Promise<NextResponse<T>>;

/**
 * Like {@link withApiAuth}, but also requires an active company + membership.
 *   - 401 if no session
 *   - 403 if no active company cookie
 *   - 403 if cookie set but user has no membership
 */
export function withApiCompanyAuth<T>(
  handler: ApiCompanyHandler<T>
): ApiAuthHandler<T> {
  return async (req: NextRequest) => {
    const user = await getUser();
    if (!user) {
      return NextResponse.json<ApiErrorBody>(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const companyId = await getActiveCompanyId();
    if (!companyId) {
      return NextResponse.json<ApiErrorBody>(
        { error: 'No active company' },
        { status: 403 }
      );
    }
    const membership = await verifyCompanyAccess(user.id, companyId);
    if (!membership) {
      return NextResponse.json<ApiErrorBody>(
        { error: 'No access to this company' },
        { status: 403 }
      );
    }
    if (!isCompanyRole(membership.role)) {
      return NextResponse.json<ApiErrorBody>(
        { error: `Invalid role stored for membership: ${membership.role}` },
        { status: 500 }
      );
    }
    return handler({ user, companyId, role: membership.role }, req);
  };
}

# ADR-0001: Unified Action & Auth Contract

**Status:** Accepted
**Date:** 2026-05-27
**Deciders:** @yoan (solo founder)
**Phase:** Phase 1 — Foundations

## Context

After the page-extraction refactor (12 commits, merged) the app converged on a
data-fetching pattern (`useActionSWR`) and a Zod parser boundary, but the
server-action surface itself is still fragmented across three feature modules.
A re-verification scan turned up:

### Three `ActionResult<T>` shapes

| Location | Shape |
|---|---|
| `lib/swr/use-action-swr.ts:5` | `type ActionResult<T> = { data?: T; error?: string }` (consumer-side, minimal) |
| `src/features/received-invoices/types.ts:68` | `interface ActionResult<T = undefined> { error?: string; data?: T }` |
| `src/features/invoicing/actions.ts:59` | `interface ActionResult<T = undefined> { error?: string; data?: T }` (identical to above) |
| `src/features/bulgarian-invoicing/actions.ts:39` | `interface ActionResult<T = undefined> { error?: string; validationErrors?: …; data?: T }` (superset with field-level Zod errors) |

The core `{ data?, error? }` is identical across all four. Only
`bulgarian-invoicing` extends it with `validationErrors`.

### Three identical `requireCompanyAccess()` implementations

`src/features/invoicing/actions.ts:75`,
`src/features/bulgarian-invoicing/actions.ts:145`,
`src/features/received-invoices/actions.ts:51` — line-for-line identical:

```ts
async function requireCompanyAccess() {
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No active company selected');
  const membership = await verifyCompanyAccess(user.id, companyId);
  if (!membership) throw new Error('No access to this company');
  return { user, companyId, role: membership.role };
}
```

### Two parallel auth-helper styles

1. **Server-action / SWR path** (above) — throws, caught by per-action `try/catch`,
   returned as `{ error }`.
2. **`useActionState` form path** — `lib/auth/middleware.ts` exports
   `validatedAction`, `validatedActionWithUser`, `withUser`. Returns
   `ActionState = { error?, success?, email?, password? }` shaped for React's
   `useActionState` second argument. Used by `app/(login)/actions.ts` only.

### Boilerplate not covered

- **Server components** repeat `const user = await getUser(); if (!user) redirect('/sign-in')`
  in 7+ pages.
- **API routes** repeat their own auth check inline — the recent P0 fix to
  `/api/invoices/extract` added one; `/api/user`, `/api/received-invoices/[id]/file`,
  `/api/received-invoices/upload` each do their own variant.

### Forces

- **Solo founder** — minimize design surface, prefer one obvious pattern over
  flexibility.
- **Strict TypeScript** (CLAUDE.md: no `any`, no `as` casts) — any unified type
  must give callers proper narrowing without forcing casts.
- **Two genuinely distinct UX needs**: SWR-called actions (return `{data,error}`)
  vs `useActionState` form actions (return `ActionState` with `prevState`). The
  ADR must not collapse these into one — they have different React-hook contracts.
- **Incremental migration** — ~15 server actions and ~5 API routes need to migrate.
  No big-bang rewrite.

## Decision

Adopt **one canonical `ActionResult<T>` for SWR-called actions**, **one set of
auth guards in `lib/auth/`**, and **keep `validatedAction` separate** for the
`useActionState` form path. Add a thin `action()` wrapper to eliminate per-action
`try/catch` boilerplate. Migrate incrementally per feature.

### Concrete shape

```ts
// lib/actions/result.ts  (NEW)

export type ValidationIssue = {
  code: string;
  field: string;
  message: string;
};

export type ActionResult<T = void> = {
  data?: T;
  error?: string;
  validationErrors?: ValidationIssue[];
};

// Construction helpers — make happy/failure paths explicit at call sites
export const ok = <T>(data: T): ActionResult<T> => ({ data });
export const fail = (error: string): ActionResult<never> => ({ error });
export const failWith = (
  validationErrors: ValidationIssue[]
): ActionResult<never> => ({
  error: 'Validation failed',
  validationErrors,
});
```

```ts
// lib/auth/guards.ts  (NEW)

import type { User, CompanyRole } from '@/lib/db/schema';

/**
 * Throws if no session. Used inside server actions wrapped by `action()`,
 * so the throw is caught and turned into `{ error }`.
 */
export async function requireUser(): Promise<User> { ... }

/**
 * Redirects to /sign-in if no session. Used in server components and `withUser`.
 * Never returns null — the redirect is terminal.
 */
export async function requireUserOrRedirect(): Promise<User> { ... }

/**
 * For server actions. Throws on any failure; the surrounding `action()`
 * wrapper turns the throw into `{ error }`.
 */
export async function requireCompanyAccess(): Promise<{
  user: User;
  companyId: number;
  role: CompanyRole;
}> { ... }

/**
 * For API route handlers. Wraps a handler with session check;
 * returns 401 JSON if no session.
 */
export function withApiAuth<T>(
  handler: (user: User, req: NextRequest) => Promise<NextResponse<T>>
): (req: NextRequest) => Promise<NextResponse<T> | NextResponse<{ error: string }>>;
```

```ts
// lib/actions/result.ts  (cont.)

/**
 * Wraps an async action body. Catches any thrown error and returns
 * a canonical `{ error }` ActionResult. Eliminates per-action try/catch.
 */
export async function action<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { data: await fn() };
  } catch (e) {
    if (e instanceof ZodError) {
      return failWith(zodToValidationIssues(e));
    }
    return { error: e instanceof Error ? e.message : 'Unexpected error' };
  }
}
```

### Resulting call-site shape

Before (current `getCompanyProfile`, 17 lines):
```ts
export async function getCompanyProfile(): Promise<ActionResult<ParsedCompany | null>> {
  try {
    const { companyId } = await requireCompanyAccess();
    const [row] = await db.select()...;
    return { data: row ? parseCompanyRow(row) : null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unauthorized' };
  }
}
```

After (8 lines, fewer chances for `e.message` drift):
```ts
export async function getCompanyProfile() {
  return action(async () => {
    const { companyId } = await requireCompanyAccess();
    const [row] = await db.select()...;
    return row ? parseCompanyRow(row) : null;
  });
}
```

## Options Considered

### Option A — Discriminated union (`{ ok: true, data } | { ok: false, error }`)

| Dimension | Assessment |
|---|---|
| Complexity | Med — every caller must check `ok` before accessing `data` |
| Type safety | High — impossible to access `data` on a failed result |
| Migration cost | High — every caller's branching code changes |
| Team familiarity | Lower (no current usage) |

**Pros:** Strongest type safety. No ambiguous "both fields present" states.
**Cons:** Every existing call site (every action + every SWR consumer) needs
edits. The `use-action-swr` wrapper would also need to change.

### Option B — Optional fields, canonical (`{ data?, error?, validationErrors? }`) ⭐

| Dimension | Assessment |
|---|---|
| Complexity | Low — matches existing usage almost exactly |
| Type safety | Med — `data` is `T \| undefined` after success path, but the
  `action()` wrapper guarantees the right state |
| Migration cost | Low — most files only change their `import` line |
| Team familiarity | High — already the shape in use |

**Pros:** Drop-in replacement for all 4 existing variants. Migration is
mostly import swaps. The `action()` helper keeps consumers from accidentally
producing invalid states.
**Cons:** Slightly looser typing than a tagged union. Mitigated by the
`action()` wrapper and the explicit `ok/fail/failWith` constructors.

### Option C — Throw-and-catch-at-boundary (no return-type discipline)

| Dimension | Assessment |
|---|---|
| Complexity | Low |
| Type safety | Poor — errors are runtime concerns only |
| Migration cost | Med |
| Team familiarity | Low — opposite of current convention |

**Pros:** No result type at all.
**Cons:** Loses Zod validation-error structure. Doesn't play well with SWR
without a custom adapter. Already rejected by the existing `useActionSWR`
design which converts back to `{data,error}` anyway.

## Trade-off Analysis

The deciding factor is **migration cost vs. type safety win**. Option A's
extra safety doesn't pay for itself when migrating ~15 actions + 30+ consumers
in a solo-founder context. Option B keeps the current ergonomics and adds the
missing pieces (`action()` wrapper, validation-error structure) without breaking
the surface. The `action()` wrapper recovers most of A's safety because callers
inside `fn` cannot return a malformed result — only `ok()`/`fail()` /
`failWith()` can.

**`validatedAction` stays separate** because `useActionState` requires the
`(prevState, formData) => state` signature, which is a different React contract
than a callable action returning `{data?, error?}`. Forcing both into one
abstraction would either break login/signup or break the SWR call sites.

## Consequences

### Becomes easier
- New server actions are 5–8 lines of body code (no try/catch boilerplate).
- New API routes are 3-line `withApiAuth(async (user) => …)` declarations.
- Zod validation errors surface to the UI in a structured way (was: flattened
  string with `'; '` separators).
- Cross-feature behavior is consistent — one mental model.

### Becomes harder
- Importing `ActionResult` requires the new `@/lib/actions/result` path
  instead of the local file. ~25 files affected.
- `bulgarian-invoicing`'s extended shape (already had `validationErrors`)
  becomes the default — code that destructured the old shape doesn't break,
  but TypeScript may surface unused-narrowing in a few places.

### Need to revisit later
- If we add background jobs (queues), they'll need their own result shape — not
  `ActionResult<T>` (which assumes a synchronous return).
- If `validatedAction` ever needs `validationErrors` shape parity, we'll
  cross-pollinate then. Not now.

## Action Items

1. **F1.2** — Create `lib/actions/result.ts` and `lib/auth/guards.ts`. Tests
   for the new helpers (auth-guard happy/sad paths, `action()` wrapper).
2. **F1.3** — Migrate `bulgarian-invoicing/actions.ts` (largest, has the
   extended shape — proves the pattern), then `invoicing/actions.ts`, then
   `received-invoices/actions.ts`. Delete the three `requireCompanyAccess`
   copies and per-feature `ActionResult` types.
3. **F1.4** — Migrate the 5 API routes to `withApiAuth`; migrate 7 server
   pages to `requireUserOrRedirect`.
4. **F1.5** — `npm run type-check && npm run lint && npm test` green. Commit
   under one atomic message.
5. **Follow-up (deferred to Phase 4)** — investigate whether the
   `useActionSWR` consumer wrapper can surface `validationErrors` directly to
   forms (currently throws on `error` only).

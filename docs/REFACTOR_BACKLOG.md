# Refactor Backlog & Session Handoff

> **For the next Claude session.** This is a living document. It captures
> everything the refactor has shipped, everything still on the list, and the
> recommended sequence for the next sitting. Update it as work lands.

**Last updated:** 2026-07-07
**Active branch when this was written:** `claude-run-1.8` (12 commits ahead of `main` — PR + merge before starting new work)

---

## 1. What this document is — read this first

Three sessions of Claude-driven refactoring took the codebase from "post-page-extraction
+ 56 known issues" to "Phase 1 + Phase 2 done + all big-leverage N-tier items shipped."
The result is on `claude-run-1.8`. Every commit is atomic, bisectable, and verified
(`type-check ✅ / lint ✅ 0 warnings / npm test ✅ 201/201 / build ✅`).

The most recent session (2026-07-07) shipped 12 items in 11 commits: N9 (form
validation `<FormField>`), N14 (RTL test setup + 33 smoke tests), N11 (invoice
detail → SWR), N12 (a11y aria-labels), A7 (cn() sweep), N13 (useToast), N5 (relocate
member actions), N4 (split queries.ts), N8 (structured logger), N10 (ReviewForm →
useReducer), N6 (composite index), N7 (pool cap), N2 (next 16 upgrade). What remains
is either **deferred-by-design** (waiting on a trigger) or **three small actionable
items** — see §4 and §5.

**You (the next session) should:**
1. **Read section 10 first** — the working-process rules: which skill to load per
   task type, how to tick the checklist as you go, how to add newly-discovered
   issues so they're not lost.
2. Skim section 2 to orient on what landed.
3. Skim section 4 to see what's still on the list.
4. Pick from section 5's tier sequence based on how much time the user has.
5. **Don't repeat work in section 2.** It's done. Trust the commit log.

**Project-wide coding rules** (enforced by lint + CLAUDE.md):
- No `any` — use `unknown` + narrow, or proper types
- No `as SomeType` casts — fix the type properly (this was the focus of F3, B1, P1.3)
- No `// @ts-ignore` / `@ts-expect-error` without explicit approval
- No `as unknown as` double-casts
- The only remaining `as` casts in app code are 2 vendor-API ones in
  `app/api/stripe/checkout/route.ts` (Stripe SDK type-union limitation) and
  1 deliberate bad-data test fixture in `validator.test.ts:170`

---

## 2. What's already done

### Phase 1 — Foundations (merged to main on a prior PR)
| Done | Item |
|---|---|
| F1 | Unified `ActionResult<T>` + auth guards (ADR-0001) |
| F2 | Drizzle migrations baseline + state-aware `db:setup` |
| F3 | Zod parser boundary completion — 19 `as` casts removed |
| F4 | Formatter + ACTIVITY_LABELS consolidation |

### Phase 2 — Design System, Velocity, Robustness (merged via PR) + Phase 3 (on `claude-run-1.8`, awaiting PR)
| Done | Item | Coverage |
|---|---|---|
| P1.1 | Fix `logActivity` broken enum strings | 7 sites in invoicing/actions.ts + 1 in bulgarian-invoicing |
| P1.2 | Centralize `logActivity` in `lib/db/activity.ts` | + `logActivityInTx` for transactional sites |
| P1.3 | Sweep 4 inline-shape casts F3 missed | + 1 extra in received-invoices/actions.ts:1080 |
| A1 | `<Dialog>` + `<ConfirmDialog>` primitives | 8 `confirm()` + 2 modals migrated |
| A2 | `<Select>` primitive | 26 raw selects migrated |
| A3 | `<Alert>` family (Error/Success/Warning/Info) | 16 banners migrated |
| A4 | `<Toast>` (Radix-based) + `lib/toast.ts` | 4 sites migrated |
| A5 | `<PageShell>` primitive | 19 page wrappers migrated |
| A6 | Brand `--primary` token | 113 hardcodes across 36 files |
| A8 | `<EntityPicker>` (Radix Popover combobox) | partner + article pickers |
| B3 | `useListPageState()` hook | 5 list pages on it |
| B4 | URL state sync | Built into B3 (bookmarkable filters) |
| B5 | `useCurrentUser()` hook | 4 SWR call sites collapsed |
| B6 | Activity icon map → `lib/activity-labels.ts` | typed exhaustive |
| C1 | `error.tsx` route boundaries | root + dashboard + company-scope |
| C2 | `loading.tsx` route boundaries | dashboard + company-scope (+1 pre-existing) |
| C4 | Unified `<PendingReviewBanner>` (was duplicated) | one component |
| C5 | Auth guards at query layer | `_components/queries.ts` defense-in-depth |
| C6 | received-invoices migrated to canonical `useListPageState` pattern | |
| N1 | Fixed silent error swallowing on mutations | 2 pages (received-invoices/[id], payments) |
| N16 | `invoices/page.tsx` → `useListPageState` | URL-syncs 5 filters |
| N17 | `payments/page.tsx` → `useListPageState` | URL-syncs date range |
| N9 | `<FormField>` primitive + form validation feedback | PartnerForm + ArticleForm + InviteMember + settings cards + create-company |
| N14 | RTL + jsdom + jest-dom setup + 33 smoke tests (core primitives; Toast/PageShell still pending — see §4) | Dialog, Select, Alert, ConfirmDialog, EntityPicker, FormField |
| N11 | `invoices/[invoiceId]/page.tsx` → `useActionSWR` | last raw-useState page migrated |
| N12 | icon-only button `aria-label` sweep | 8 sites |
| N13 | `useToast()` ergonomic alias | added in `lib/toast.ts` |
| N7 | Drizzle pool `max: 10` | conservative under Supabase pooler |
| N6 | composite `idx_activity_logs_company_ts` | migration 0001 |
| N2 | next 15-canary → 16.2.6 stable | PPR follow-up: N22 |
| A7 | `cn()` adoption sweep | 38 sites, 24 files |
| N5 | member-management actions moved from (login) → invoicing feature | requireCompanyAccess collapses the 2-step auth check |
| N4 | `lib/db/queries.ts` split into 8 per-feature files + barrel | no consumer changes |
| N8 | `lib/logger.ts` + console.* sweep | dev pretty, prod JSON, child-bindings for request scope |
| N10 | ReviewForm → useReducer | 7-variant FormAction; `touched` kept as useState |

---

## 3. Key files & locations to know about

When a fresh session needs to orient, these are the load-bearing files:

### Foundations
- **`docs/adr/0001-unified-action-and-auth-contract.md`** — the action/auth contract ADR
- **`docs/migrations.md`** — Drizzle migrations workflow + `--reset-journal` flag
- **`lib/actions/result.ts`** — `ActionResult<T>`, `ok()`, `fail()`, `failWith()`, `action()` wrapper, `zodToValidationIssues()`
- **`lib/auth/guards.ts`** — `requireUser`, `requireUserOrRedirect`, `requireCompanyAccess`, `withApiAuth`, `withApiCompanyAuth`
- **`lib/db/activity.ts`** — `logActivity`, `logActivityInTx` (centralized; use these, never insert directly)
- **`lib/db/queries/`** — split into per-feature modules: `auth.ts`, `companies.ts`, `subscriptions.ts`, `activity.ts`, `invoices.ts`, `partners.ts`, `articles.ts`, `dashboard.ts` + `index.ts` barrel. Import path unchanged: `from '@/lib/db/queries'`.
- **`lib/db/schema.ts`** — 872 lines, single source of truth; D1 to split
- **`lib/logger.ts`** — structured logger (dev pretty / prod JSON); `logger.info/warn/error`, `logger.child({…})` for request scope. Use this, never raw `console.*` (CLI scripts excepted).

### Design system primitives (added in Phase 2)
- `components/ui/dialog.tsx` — Dialog + Header/Title/Description/Footer/Close
- `components/ui/confirm-dialog.tsx` — opinionated wrapper for destructive flows
- `components/ui/select.tsx` — Radix Select
- `components/ui/alert.tsx` — Alert family with `<AlertTitle>` / `<AlertDescription>` + icons
- `components/ui/toaster.tsx` — Toaster (mount once in root layout)
- `components/page-shell.tsx` — `<PageShell maxWidth="…" className="…">`
- `components/forms/entity-picker.tsx` — searchable combobox

### Hooks & client utilities
- `lib/format.ts` — formatDate / formatMoney / relativeTime (UI; differs from
  bulgarian-invoicing/formatter.ts which is for document/PDF rendering)
- `lib/activity-labels.ts` — `ACTIVITY_LABELS`, `isActivityType`, `formatActivityAction`
- `lib/toast.ts` — `toast.success(...)`, `toast.error(...)`, etc.
- `lib/swr/use-action-swr.ts` — typed SWR wrapper for `{data?, error?}` actions
- `lib/swr/use-list-page-state.ts` — composite hook for list pages
- `lib/swr/use-current-user.ts` — typed `/api/user` SWR

### Pages on the canonical `useListPageState` pattern (5 of them)
- `app/(dashboard)/c/[companyId]/partners/page.tsx`
- `app/(dashboard)/c/[companyId]/articles/page.tsx`
- `app/(dashboard)/c/[companyId]/received-invoices/page.tsx`
- `app/(dashboard)/c/[companyId]/invoices/page.tsx`
- `app/(dashboard)/c/[companyId]/payments/page.tsx`

### Route boundaries (error/loading)
- `app/error.tsx` — root
- `app/(dashboard)/error.tsx` — dashboard scope
- `app/(dashboard)/loading.tsx` — dashboard scope
- `app/(dashboard)/c/[companyId]/error.tsx` — company scope
- `app/(dashboard)/c/[companyId]/loading.tsx` — company scope
- `app/(dashboard)/c/[companyId]/activity/loading.tsx` — pre-existing

### Codebase facts (measured 2026-07-07)
- 100 .tsx files in `app/` — 65 are `'use client'` (65%)
- `console.*` now only in CLI scripts (`db/seed.ts`, `db/setup.ts`), env-gated
  `debug/page.tsx`, and a README snippet — all app/lib/src runtime sites go through
  `lib/logger.ts` (N8 done). `lib/logger.ts` itself is the one allowed direct caller.
- Largest files (>400 lines, excl. tests): `received-invoices/actions.ts` (1117),
  `bulgarian-invoicing/actions.ts` (1104), `ReviewForm.tsx` (927), `lib/db/schema.ts`
  (872, D1 to split), `invoicing/actions.ts` (817), `lib/db/seed.ts` (578, CLI),
  `app/page.tsx` landing (427)
- 1 explicit TODO left in code: `activity_logs.description` column (N20). The Sentry-hook
  TODOs in the error boundaries were resolved by N8 (they now call `logger.error`).

---

## 4. What's still pending — Master checklist

### Track A — Design System — done ✅
- [x] **A7** `cn()` adoption — 38 template-literal classNames across 24 files converted to `cn(...)`. `cn` import added where missing; defensive `?? ''` guards dropped (cn handles them).

### Track B — Velocity Helpers (1 deliberately deferred)
- [ ] **B7** `defineEnum()` + `createCompanyCrud()` — **deferred until 3rd CRUD entity arrives**

### Track C — Robustness — all done ✅

### Track D — Structural (all deferred by design)
- [ ] **D1** Split `lib/db/schema.ts` (872 lines) — *when next big feature touches it*
- [ ] **D2** CHECK constraints on status varchars — *pair with RLS rollout*
- [ ] **D3** Soft-delete consistency (partners/articles/invoices) — *UX decision needed*
- [ ] **D4** `createdByUserId` consistency on partners/articles — *audit-trail design call*
- [ ] **D5** Reduce `'use client'` count (66/100 files) — *defer until measured*

### N-tier — 23 items: 14 done, N14 partial, 8 pending
*(pending = 3 actionable: N15, N22, N23 · 5 deferred/blocked: N3, N18, N19, N20, N21)*
- [x] **N2** `next@canary` → `next@16.2.6` stable — also removed `experimental.clientSegmentCache` (gone in 16) and disabled `experimental.ppr` (now opt-in via `cacheComponents`, needs a separate route-config sweep). See N22.
- [ ] **N3** Stripe webhook idempotency — **out of scope per user**
- [x] **N4** Split `lib/db/queries.ts` (768 lines) → `lib/db/queries/{auth,companies,subscriptions,activity,invoices,partners,articles,dashboard}.ts` + barrel `index.ts`. No public-API change; consumers still import from `@/lib/db/queries`. No cross-module circular deps.
- [x] **N5** `removeCompanyMember` + `inviteCompanyMember` moved to `src/features/invoicing/actions.ts` (J section). `acceptInvitation` stays — its logic is woven into `signUp` (auth flow), not a separate action. Both relocated actions now use `requireCompanyAccess()` instead of the old `getActiveCompanyId + verifyCompanyAccess` 2-step.
- [x] **N6** Composite index on `activity_log(companyId, timestamp DESC)` — migration `0001_shocking_tombstone.sql`
- [x] **N7** Drizzle connection pool — `max: 10` set in `lib/db/drizzle.ts`
- [x] **N8** Structured logger `lib/logger.ts` — pretty-print in dev, JSON-per-line in prod. Replaced 12 live `console.*` calls across 9 files (api routes + lib + stripe). All 3 `error.tsx` boundaries wired up. CLI scripts (`db/seed.ts`, `db/setup.ts`) + `debug/page.tsx` intentionally kept on raw console — CLI UX / env-gated.
- [x] **N9** Field-level form validation feedback — `<FormField>` primitive at `components/forms/form-field.tsx`; wired on PartnerForm + ArticleForm + InviteMemberForm + settings (Identity/Address/Bank/InvoiceDefaults) + create-company. `validatedAction` middleware extended to surface `validationErrors` alongside `error`. Onboarding steps still on raw labels — deferred.
- [x] **N10** `ReviewForm.tsx` → `useReducer` — 15 `useState` calls consolidated into one `useReducer` with a 7-variant `FormAction` discriminated union (`SET`, `SET_SUPPLIER`, `LINK_PARTNER`, `UNLINK_PARTNER`, `ADD_LINE`, `UPDATE_LINE`, `REMOVE_LINE`). State + reducer co-located in `components/received-invoices/review-form-state.ts` (95 lines). `touched` Set intentionally stays as a separate useState — it's UX state, not domain state. Behavior identical.
- [x] **N11** `invoices/[invoiceId]/page.tsx` migrated to `useActionSWR` — useState/useEffect quartet removed, `mutate(data, {revalidate:false})` used after action returns updated invoice
- [x] **N12** Icon-only button `aria-label` sweep — added labels to ArticlesStep remove, upload back, new-invoice back, ReviewHeader back, DetailHeader back, LineItemsCard remove, ReviewForm remove, SearchBar search; ArticleForm/PartnerForm close + invoice-detail back already labeled in N9. RowActionsMenu / ReceivedInvoiceRowActions use `<span className="sr-only">Actions</span>` (canonical).
- [x] **N13** `useToast()` ergonomic wrapper added in `lib/toast.ts`
- [ ] **N14** `@testing-library/react` setup + smoke tests — *partial*: RTL + jsdom + jest-dom installed; vitest.config.ts → jsdom env + setup; 33 tests for Dialog, Select, Alert, ConfirmDialog, EntityPicker, FormField. Still TODO: Toast, PageShell (low-value — mostly markup).
- [ ] **N15** Integration tests for `createInvoiceDraft → finalize → credit-note` flow — **now unblocked** (N14 set up RTL + jsdom). Actionable — see §5.
- [ ] **N18** `settings/members/page.tsx` → `useListPageState` — *deferred*: `getCompanyMembersAction` is no-param but `useListPageState` requires `{...filters, page, pageSize}`. Page already on `useActionSWR` with manual mutation-error tracking; migration adds type-shape friction without benefit until a real filter ships. Revisit when members gets search.
- [ ] **N19** i18n layer — BG-EN mix; defer until shipping beyond BG
- [ ] **N20** `activity_logs.description` column — CANCEL_INVOICE reason currently dropped from feed (TODO in `bulgarian-invoicing/actions.ts`)
- [ ] **N21** `debug/page.tsx` (399 lines) — env-gated correctly, fine as-is
- [ ] **N22** Re-enable PPR via `cacheComponents: true` — Next 16 renamed `experimental.ppr` and made it opt-in caching. Blocks: 3 routes export `dynamic`/`revalidate` (`c/[companyId]/dashboard/page.tsx:25`, `debug/page.tsx:18`, `pricing/page.tsx:7`); migrate each to `'use cache'` + `cacheLife` semantics, plus middleware → proxy rename. Effort: M.
- [ ] **N23** `ReviewForm.tsx` line-item map recomputes `calculateReceivedInvoice(lineItems)` O(n) times per render — once per row instead of once per render. The `totals` `useMemo` already does the same compute; the row loop should reuse its result. Spotted during N10. Effort: S.

---

## 5. Recommended sequence for next session

**State:** all big-leverage N-tier + design-system items are shipped. What remains is
**three small, independent, actionable items** plus optional test polish. None block
each other; pick in any order.

### 🎯 Actionable now

**A — N23: ReviewForm line-item perf (S, ~30min)**
- **Where**: `components/received-invoices/ReviewForm.tsx`, the line-item `.map(...)` in
  the items table (was ~line 641 pre-N10; grep for `calculateReceivedInvoice`).
- **Problem**: `calculateReceivedInvoice(lineItems)` is recomputed once *per row* inside the
  map — O(n) recomputes per render. The `totals` `useMemo` already computes the same thing.
- **Fix**: hoist the per-line calc results out of the map — compute the `items` array once
  (either extend the existing `totals` `useMemo` to expose per-line results, or add a sibling
  `useMemo`) and index into it in the row loop.
- **Verify**: behavior identical (same rendered numbers); type-check + lint + `npm test` green.

**B — N22: Re-enable PPR via `cacheComponents: true` (M, ~half day)**
- **Why deferred in N2**: Next 16 renamed `experimental.ppr` → opt-in `cacheComponents`,
  which is incompatible with per-route `dynamic`/`revalidate` exports.
- **Blockers to clear first** (build errors point right at them):
  - `app/(dashboard)/c/[companyId]/dashboard/page.tsx` — `export const dynamic = 'force-dynamic'`
  - `app/(dashboard)/debug/page.tsx` — `export const dynamic = 'force-dynamic'`
  - `app/(dashboard)/pricing/page.tsx` — `export const revalidate = 3600`
  - `middleware.ts` — Next 16 deprecates the `middleware` convention in favor of `proxy`
- **Approach**: migrate each route to the `'use cache'` + `cacheLife(...)` model, rename
  middleware → proxy, then flip `cacheComponents: true` in `next.config.ts` and `npm run build`.
- **Skill**: load `anthropic-skills:senior-frontend`; consult Next 16 cacheComponents docs.

**C — N15: Integration tests for the invoice lifecycle (M, ~half day)**
- **Now unblocked** — N14 set up RTL + jsdom + jest-dom.
- **Flow to cover**: `createInvoiceDraft → finalize → credit-note`. Also good: partner-link on
  received-invoice review, and the `ActionResult` failure surfacing through `<FormField>`.
- **Skill**: `anthropic-skills:tdd-guide` + `engineering:testing-strategy`.

### ✨ Optional polish
- **N14 leftovers (XS)**: Toast + PageShell smoke tests. Low value — both are mostly markup;
  do them only if you want the primitive suite to be exhaustive.

### ⏸️ Defer (until trigger)
| Item | Trigger to start |
|---|---|
| B7 `defineEnum`/`createCompanyCrud` | When adding 3rd entity (expenses? projects?) |
| D1 schema.ts split (872 lines) | Next time you add 2+ tables in one feature |
| D2 CHECK constraints | When adding RLS |
| D3 soft-delete consistency | UX decision: "should partners be restorable?" |
| D4 createdByUserId | When audit-trail UX is needed |
| D5 reduce 'use client' (65/100) | When measured client bundle becomes a problem |
| N3 Stripe webhook idempotency | First time Stripe replays during deploy hurts |
| N18 members → useListPageState | When members list gets a real filter/search |
| N19 i18n | When shipping beyond BG |
| N20 activity_logs.description column | When users complain about lost cancel reason |
| N21 debug/page.tsx (399 lines) | Fine as-is — env-gated correctly |

---

## 6. Suggested workflows by available time

| Time | Pick |
|---|---|
| **30 min** | N23 (ReviewForm perf) — one-file, mechanical, measurable. |
| **Half day** | N22 (PPR re-enable) **or** N15 (integration tests). Independent; either is a clean self-contained PR. |
| **Full day** | N22 + N15 together, or one of them + the N14 polish tests. |
| **New feature instead?** | Nothing in this backlog blocks feature work — see §7. A 3rd CRUD entity would also unlock B7. |

---

## 7. Strategic notes

- **Nothing critical blocks new feature work.** The `useListPageState` + `action()` + `requireCompanyAccess` + parser stack means a new entity ships in ~150 lines.
- **Nothing critical blocks page restructuring.** `PageShell` + Dialog + Select + Alert + Toast cover the design surface.
- **Don't preemptively build B7.** Speculative abstraction. Wait until you have a 3rd entity (e.g., expenses or projects) — then the `createCompanyCrud()` factory has 3 real consumers to validate against.
- **The branch is at a strong stopping point right now.** PR before starting anything new.

---

## 8. Verification commands (sanity-check anytime)

```bash
# Standard verification trio (must be green before commit)
npm run type-check
npm run lint
npm test

# Confirm no forbidden casts in app code (only validator.test.ts fixture should remain)
grep -rEn "\\bas\\s+(unknown\\s+as|PartySnapshot|LineItem\\[\\]|InvoiceTotals|NewInvoice|NewPartner|NewArticle|PaymentMethod|PaymentStatus|AccountingStatus|VatMode|DocType|BgVatRate|ActivityType)\\b" \
  --include="*.ts" --include="*.tsx" \
  app/ src/ components/ lib/

# Confirm no leftover orange-N color hardcodes
grep -rln "orange-[0-9]" app/ components/ --include="*.tsx" --include="*.ts"

# Confirm no raw <select> elements (all on the primitive)
grep -rn "<select " app/ components/

# Confirm no window.confirm() (all on ConfirmDialog)
grep -rn "window\\.confirm\\|^\\s*if\\s*(!confirm(" app/

# Test count baseline
npm test 2>&1 | grep -E "Tests +\\d+ passed"
# Expected: 201 passed (18 files)
```

---

## 9. Quick "first prompt" for the next session

> Continuing the invoice-starter refactor. Phase 1 + most of Phase 2 are merged via PR.
>
> Read `docs/REFACTOR_BACKLOG.md` for full context. The checklist + recommended sequence is there.
>


That's it. The doc carries the institutional memory.

---

## 10. Working process — instructions for the AI session

**Read this section before starting any task.** It is the operating contract
between you (the AI) and this living document.

### 10.1 Load the right skill before you start

The plugin ecosystem has specialized skills. **Load the matching one(s) first
via the `Skill` tool** — they bring conventions, common pitfalls, and
ready-made patterns into your context.

| Task type | Item examples | Skill(s) to load |
|---|---|---|
| Frontend / UI / component work | N9 (form validation), N10 (ReviewForm reducer), N11/N18 (page migrations), N12 (a11y), A7 (cn sweep) | `anthropic-skills:senior-frontend` |
| Backend / server actions / API routes | N4 (split queries.ts), N5 (move member actions), N8 (logger) | `anthropic-skills:senior-backend` |
| Database / migrations / schema / perf | N6 (composite index), N7 (pool config), N20 (description column), D1 (schema split), D2 (CHECK constraints) | `anthropic-skills:senior-data-engineer` |
| Test setup & writing tests | N14 (RTL setup), N15 (integration tests) | `anthropic-skills:tdd-guide` + `engineering:testing-strategy` |
| Architecture decisions / ADR | B7 (createCompanyCrud factory), any new pattern decision | `engineering:architecture` → `anthropic-skills:senior-architect` |
| Security audit / new endpoint review | New API routes, auth changes, anything user-input-touching | `anthropic-skills:senior-security`; run `/security-review` over the diff before commit |
| Bug investigation (unknown root cause) | A "this doesn't work" report with no clear lead | `engineering:debug` |
| Code review pass before commit | Big diffs, anything touching auth or money | `anthropic-skills:code-reviewer` or `/review` |
| Pure mechanical sweep | A7 (cn() adoption), large rename, brand color sweep | No skill needed — dispatch a sub-agent with strict rules |
| Tech-debt prioritization / re-scan | "Find more issues" sessions | `engineering:tech-debt` |
| Deploy readiness check | Before a PR ships | `engineering:deploy-checklist` |

**Multiple skills can be active.** For F1.2 (auth contract implementation) we
had `engineering:architecture` (ADR) + `anthropic-skills:senior-architect` +
`anthropic-skills:senior-backend` all loaded. Stack them.

**Don't skip the skill load** even on "small" tasks — the skill often
surfaces a pattern that prevents 30 minutes of debugging later (e.g.
`senior-frontend` reminded us about `aria-*` attributes during the dialog
build).

### 10.2 Mark progress in §4 as you work

The checklist in §4 is the single source of truth for "what's left." Update it
in the same commit as the work itself:

- **Mark fully complete** with `- [x]` only when:
  - The code change is in
  - `npm run type-check` is clean
  - `npm run lint` is 0 warnings, 0 errors
  - `npm test` passes (current baseline: 201)
  - It's committed

  Example:
  ```diff
  - - [ ] **N9** Field-level form validation feedback — `aria-invalid` + inline errors
  + - [x] **N9** Field-level form validation feedback — done in commit `abc1234`; 8 forms migrated, `<FormField>` primitive at `components/forms/form-field.tsx`
  ```

- **If partially complete**, leave `- [ ]` and add an inline status note:
  ```diff
  - - [ ] **N9** Field-level form validation feedback
  + - [ ] **N9** Field-level form validation feedback — *partial*: PartnerForm + ArticleForm done; ~6 forms remain (invoice, settings, onboarding/*)
  ```

- **Also append a one-line summary to §2** when something lands — keeps the
  "what's done" table current.

### 10.3 Add new findings immediately

If you discover a problem you can't fix this session — **don't lose it**. Add
it to §4's N-tier the moment you spot it:

```diff
+ - [ ] **N22** `<short title>` — *<why it matters>*. <File:line if known>. Effort: S/M/L.
```

Number continues from the highest existing `N` (start at N24 — N23 is the
current ceiling).

Rules of thumb for what counts as "new finding worth adding":
- A real bug (not "this could be nicer") → always add
- A type-safety violation you didn't have time to fix → always add
- A pattern that's diverged across 2+ places → add if 3+ would be likely
- A perf concern with concrete evidence → add
- Vague "this code is ugly" — skip; just refactor or move on

If unsure, err on the side of adding — better to have noise than to lose it.

### 10.4 Use the harness Task tool for in-session tracking

Within a single session, also use the `TaskCreate` / `TaskUpdate` tools to
track the steps of the work you're actively doing. This is separate from §4
(which is cross-session). Within-session tasks die at session end; §4 is
permanent.

Pattern:
1. Look at §4, pick one or more `[ ]` items for this session.
2. Use `TaskCreate` to break each picked item into 2-5 concrete steps.
3. `TaskUpdate` to `in_progress` when starting a step, `completed` when done.
4. When all steps of a §4 item are complete, tick the §4 box and append to §2.

### 10.5 End-of-session report

Before the user signs off, print a short summary in chat:

```
### Session report (YYYY-MM-DD)

**Shipped:**
- ✅ N9 — form validation feedback (commit abc1234, 8 forms, +12 tests)
- ✅ N13 — useToast() wrapper (commit def5678)

**In progress (left for next time):**
- 🟡 N14 — RTL setup done; 2 of 5 smoke tests written

**New issues found and added to §4:**
- N22 — <description>
- N23 — <description>

**Suggested next pickup:**
- Finish N14 (3 tests remaining, ~1h)
- Or start T2.3 / A7 if you want a quick cosmetic win

**Branch state:**
- claude-run-1.8: 4 commits ahead of main, all green
```

This makes session-to-session handoff trivial.

### 10.6 When in doubt

If you're stuck on whether something is in scope, an architectural decision,
or a tradeoff worth documenting — **stop and ask the user with
`AskUserQuestion`**. Cheap interruptions beat silently picking the wrong
direction.

If a change is bigger than expected (e.g. N4 turns out to require updating 30
import sites) — **flag it and ask** whether to break it across multiple
commits or batch in one. The 13-commit `claude-run-1.7` was kept clean
exactly because we asked these questions in real time.

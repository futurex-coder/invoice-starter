# Refactor Backlog & Session Handoff

> **For the next Claude session.** This is a living document. It captures
> everything the refactor has shipped, everything still on the list, and the
> recommended sequence for the next sitting. Update it as work lands.

**Last updated:** 2026-05-28
**Active branch when this was written:** `claude-run-1.7` (13 commits ahead of `main` — PR + merge before starting new work)

---

## 1. What this document is — read this first

Two sessions of Claude-driven refactoring took the codebase from "post-page-extraction
+ 56 known issues" to "Phase 1 + most of Phase 2 done + 24 newly-found items, 4 of those
also done." The result is on `claude-run-1.7`. Every commit is atomic, bisectable,
and verified (`type-check ✅ / lint ✅ 0 warnings / npm test ✅ 168/168`).

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

### Phase 2 — Design System, Velocity, Robustness (on `claude-run-1.7`, awaiting PR)
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
| N14 | RTL + jsdom + jest-dom setup + 33 smoke tests | Dialog, Select, Alert, ConfirmDialog, EntityPicker, FormField |

---

## 3. Key files & locations to know about

When a fresh session needs to orient, these are the load-bearing files:

### Foundations
- **`docs/adr/0001-unified-action-and-auth-contract.md`** — the action/auth contract ADR
- **`docs/migrations.md`** — Drizzle migrations workflow + `--reset-journal` flag
- **`lib/actions/result.ts`** — `ActionResult<T>`, `ok()`, `fail()`, `failWith()`, `action()` wrapper, `zodToValidationIssues()`
- **`lib/auth/guards.ts`** — `requireUser`, `requireUserOrRedirect`, `requireCompanyAccess`, `withApiAuth`, `withApiCompanyAuth`
- **`lib/db/activity.ts`** — `logActivity`, `logActivityInTx` (centralized; use these, never insert directly)
- **`lib/db/queries.ts`** — getUser, getSafeUser, getActiveCompanyId, verifyCompanyAccess (+ ~700 more lines — N4 to split)
- **`lib/db/schema.ts`** — 856 lines, single source of truth; D1 to split

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

### Codebase facts (measured 2026-05-28)
- 100 .tsx files in `app/` — 66 are `'use client'` (66%)
- 71 `console.*` calls across `app/lib/src` (no structured logger — N8)
- 2 files over 400 lines: `ReviewForm.tsx` (886) + `app/page.tsx` landing (423)
- 2 explicit TODOs in code: Sentry hook in error.tsx; `activity_logs.description` column

---

## 4. What's still pending — Master checklist

### Track A — Design System (1 pending)
- [ ] **A7** `cn()` adoption in pages — cosmetic sweep, ~2h

### Track B — Velocity Helpers (1 deliberately deferred)
- [ ] **B7** `defineEnum()` + `createCompanyCrud()` — **deferred until 3rd CRUD entity arrives**

### Track C — Robustness — all done ✅

### Track D — Structural (all deferred by design)
- [ ] **D1** Split `lib/db/schema.ts` (856 lines) — *when next big feature touches it*
- [ ] **D2** CHECK constraints on status varchars — *pair with RLS rollout*
- [ ] **D3** Soft-delete consistency (partners/articles/invoices) — *UX decision needed*
- [ ] **D4** `createdByUserId` consistency on partners/articles — *audit-trail design call*
- [ ] **D5** Reduce `'use client'` count (66/100 files) — *defer until measured*

### N-tier — found in scans, 6 done, 15 still pending
- [ ] **N2** `next@canary` pinned in package.json — unpin to stable
- [ ] **N3** Stripe webhook idempotency — **out of scope per user**
- [ ] **N4** Split `lib/db/queries.ts` (755 lines) into per-feature files
- [ ] **N5** Move `removeCompanyMember`/`inviteCompanyMember`/`acceptInvitation` from `app/(login)/actions.ts` → `src/features/invoicing/actions.ts`
- [ ] **N6** Composite index on `activity_log(companyId, timestamp DESC)`
- [ ] **N7** Drizzle connection pool config (`max: 10`)
- [ ] **N8** Structured logger — replace 71 `console.*` sites; wire into `error.tsx` boundaries (3 TODOs already in code)
- [x] **N9** Field-level form validation feedback — `<FormField>` primitive at `components/forms/form-field.tsx`; wired on PartnerForm + ArticleForm + InviteMemberForm + settings (Identity/Address/Bank/InvoiceDefaults) + create-company. `validatedAction` middleware extended to surface `validationErrors` alongside `error`. Onboarding steps still on raw labels — deferred.
- [ ] **N10** `ReviewForm.tsx` (886 lines) → `useReducer` (matches pattern of `invoices/new/_components/form-state.ts`)
- [ ] **N11** `invoices/[invoiceId]/page.tsx` — last page on raw `useState/useEffect/fetch`; migrate to `useActionSWR`
- [ ] **N12** Icon-only buttons missing `aria-label` (a11y sweep)
- [ ] **N13** `useToast()` ergonomic wrapper — 15 min
- [ ] **N14** `@testing-library/react` setup + smoke tests — *partial*: RTL + jsdom + jest-dom installed; vitest.config.ts → jsdom env + setup; 33 tests for Dialog, Select, Alert, ConfirmDialog, EntityPicker, FormField. Still TODO: Toast, PageShell (low-value — mostly markup).
- [ ] **N15** Integration tests for `createInvoiceDraft → finalize → credit-note` flow — *after N14*
- [ ] **N18** `settings/members/page.tsx` → `useListPageState` (no pagination — small consistency win)
- [ ] **N19** i18n layer — BG-EN mix; defer until shipping beyond BG
- [ ] **N20** `activity_logs.description` column — CANCEL_INVOICE reason currently dropped from feed (TODO in `bulgarian-invoicing/actions.ts`)
- [ ] **N21** `debug/page.tsx` (399 lines) — env-gated correctly, fine as-is

---

## 5. Recommended sequence for next session

Pick a tier based on available time. Each tier is roughly independent.

### 🥇 Tier 1 — Big-leverage (~1 day)

**T1.1 — N9: Field-level form validation feedback (3–4h)**
- **Why first**: Biggest single user-facing UX improvement remaining. Touches every form.
- **Approach**:
  1. Add a `<FormField field="legalName" errors={result.validationErrors} />` primitive in `components/forms/form-field.tsx` that takes children (the input), the field name, and the `validationErrors` array from `ActionResult`. Renders children with `aria-invalid` + inline error message below on mismatch.
  2. The `action()` wrapper already produces structured `validationErrors` from any `ZodError` — consumers just need to surface it. Currently `ErrorAlert` only shows the summary `error` string.
  3. Modify form parents to thread `validationErrors` down to fields.
- **Files affected**: ~8 forms in `_components/` folders. Start with PartnerForm or ArticleForm (smallest). The pattern then mechanically applies to the rest.
- **Gotcha**: Some forms today don't use Zod-validated server actions yet — they hand-roll validation. Those need to be flipped to `schema.parse(input)` first (the `action()` wrapper catches ZodError → validationErrors). See ADR-0001 for the canonical pattern.

**T1.2 — N14: `@testing-library/react` setup + 5 component tests (3h)**
- **Why now**: New primitives have zero tests. Once RTL is set up, each primitive is a 30-min smoke test. After that, all future primitives get a test in 10 min.
- **Approach**:
  1. `npm install -D @testing-library/react @testing-library/user-event jsdom`
  2. Update `vitest.config.ts`: add `test.environment: 'jsdom'`, `test.setupFiles: ['./vitest.setup.ts']`
  3. Create `vitest.setup.ts` with `import '@testing-library/jest-dom/vitest'`
  4. Write 5 smoke tests:
     - `components/ui/dialog.test.tsx` — open/close + ESC
     - `components/ui/select.test.tsx` — keyboard nav (arrow + Enter)
     - `components/ui/confirm-dialog.test.tsx` — confirm/cancel paths + async onConfirm
     - `components/ui/alert.test.tsx` — renders by variant + custom icon
     - `components/forms/entity-picker.test.tsx` — filter behavior + clear option
- **Gotcha**: vitest config currently includes `lib/**/*.test.ts` and `src/**/*.test.ts` and `app/**/*.test.ts` — make sure `components/**/*.test.tsx` gets added too.

### 🥈 Tier 2 — Mid-leverage cleanups (~1 day)

**T2.1 — N18 + N11: Last two list-page holdouts (2h)**
- **N18**: `app/(dashboard)/c/[companyId]/settings/members/page.tsx` — small migration; uses `useActionSWR` already, just swap to `useListPageState({swrKey:'companyMembers', defaults:{search:''}, action: getCompanyMembersAction})`. No pagination wired.
- **N11**: `app/(dashboard)/c/[companyId]/invoices/[invoiceId]/page.tsx` — last page on raw useState/useEffect/fetch. Pattern:
  ```ts
  const { data: invoice, isLoading, error, mutate } = useActionSWR(
    ['invoice', id],
    () => getInvoice(id)
  );
  ```
  Then delete the `[invoice, setInvoice, loading, setLoading, error, setError]` useState quartet + the `useEffect` that fetches.

**T2.2 — N12: Icon-only button `aria-label` sweep (1h)**
- Grep: `grep -rn 'size="icon"' app/ components/ | wc -l`
- For each `<Button size="icon">` without text, add `aria-label="…"`. Also any `<button>` with only an icon child.
- Pattern files: `LineItemsCard.tsx` (remove-line button), `ArticleForm.tsx` (X close), `PartnerForm.tsx` (X close), `ArticlesStep.tsx`, `ReviewForm.tsx` line-item delete buttons, `MembersTable.tsx` remove member, `SearchBar.tsx`.

**T2.3 — A7: `cn()` adoption in pages (1–2h, mechanical)**
- Sweep template-literal classNames into `cn()` calls in `app/` pages and `_components/`.
- Pattern:
  ```tsx
  className={`base-class ${cond ? 'a' : 'b'} ${other}`}
  // becomes
  className={cn('base-class', cond ? 'a' : 'b', other)}
  ```
- Could be done by an agent.

**T2.4 — N13: `useToast()` wrapper (15min)**
- Add to `lib/toast.ts`:
  ```ts
  export function useToast() { return toast; }
  ```
- Pure ergonomics — keeps the React hook idiom for callers who prefer it.

### 🥉 Tier 3 — Architecture / quality (~1–2 days)

**T3.1 — N8: Structured logger (4h)**
- Pick: lightweight (pino) or self-rolled with levels (debug/info/warn/error) + simple JSON output in prod / pretty in dev.
- Replace 71 `console.*` sites in `app/api/*`, `lib/payments/*`, `lib/ai/*`, the 3 `error.tsx` boundaries.
- Sentry / Logflare / Axiom integration is the right next step but pick the lib first.

**T3.2 — N4: Split `lib/db/queries.ts` (2h)**
- Currently 755 lines mixing auth, companies, partners, articles, invoices, activity.
- Target structure:
  ```
  lib/db/queries/
    auth.ts        (getUser, getSafeUser, verifyToken-related)
    companies.ts   (verifyCompanyAccess, getCompaniesForUser, getActiveCompanyId, getCompanyWithMembers, transferCompanyOwnership, softDeleteCompany, restoreCompany, ...)
    partners.ts    (findCompanyByEik, getPartnersForCompany, findPartnerByEik)
    articles.ts    (getArticlesForCompany)
    invoices.ts    (getInvoicesForCompany, getNextInvoiceNumber)
    activity.ts    (getActivityLogs, getActivityLogsForDashboard, getDeletedCompaniesForUser)
    index.ts       (barrel re-export for compat with existing imports)
  ```
- All imports today are `from '@/lib/db/queries'` — keep the barrel so nothing breaks.

**T3.3 — N5: Relocate member-management actions (1h)**
- Move `removeCompanyMember`, `inviteCompanyMember`, `acceptInvitation`, `signUp`'s company-create branch from `app/(login)/actions.ts` → `src/features/invoicing/actions.ts` (sits next to `transferOwnershipAction`, `deleteCompanyAction`).
- Update import sites (~5 files).

**T3.4 — N10: ReviewForm → useReducer (4h)**
- 886-line file with ~30 `useState` calls. Big readability win.
- Follow the pattern of `app/(dashboard)/c/[companyId]/invoices/new/_components/form-state.ts` — `FormState` type, `FormAction` discriminated union, reducer, initial-state factory.
- Co-locate at `components/received-invoices/review-form-state.ts` or inline in `ReviewForm.tsx`.

### 🛠️ Tier 4 — Perf / DB hygiene (~half day)

**T4.1 — N6: Composite index (30min + migration)**
- Add to `lib/db/schema.ts` activityLogs:
  ```ts
  (table) => ({
    idx_company_timestamp: index('idx_activity_company_ts')
      .on(table.companyId, sql`${table.timestamp} DESC NULLS LAST`),
  })
  ```
- Run `npm run db:generate` → review SQL → commit → `npm run db:migrate`.

**T4.2 — N7: Connection pool (15min)**
- `lib/db/drizzle.ts`:
  ```ts
  export const client = postgres(process.env.POSTGRES_URL!, {
    prepare: false,
    max: 10,
  });
  ```
- Verify with Supabase pooler URL limits (their pooler typically allows 60 connections; 10 per Next.js instance is conservative).

**T4.3 — N2: Unpin Next from canary (15min)**
- `package.json` has `next@15.6.0-canary.59` + `eslint-config-next@16.2.4` (major mismatch).
- `npm install next@latest eslint-config-next@latest` (or pick a specific stable like `15.0.x`)
- Then `npm run build` + smoke test before committing.

### ⏸️ Defer (until trigger)
| Item | Trigger to start |
|---|---|
| B7 `defineEnum`/`createCompanyCrud` | When adding 3rd entity (expenses? projects?) |
| D1 schema.ts split | Next time you add 2+ tables in one feature |
| D2 CHECK constraints | When adding RLS |
| D3 soft-delete consistency | UX decision: "should partners be restorable?" |
| D4 createdByUserId | When audit-trail UX is needed |
| D5 reduce 'use client' | When measured client bundle becomes a problem |
| N3 Stripe webhook idempotency | First time Stripe replays during deploy hurts |
| N15 Integration tests | After N14 testing setup |
| N19 i18n | When shipping beyond BG |
| N20 activity_logs.description column | When users complain about lost cancel reason |
| N21 debug/page.tsx (399 lines) | Fine as-is — env-gated correctly |

---

## 6. Suggested workflows by available time

| Time | Pick |
|---|---|
| **1 hour** | T4.3 (N2 unpin next) + T4.2 (N7 pool) + T2.4 (N13 useToast). Three XS items, real improvements, one PR. |
| **Half day** | T1.1 alone (N9 form validation). Biggest single user-facing UX win remaining. |
| **Full day** | T1.1 + T1.2 (N9 + N14). Foundational pair: form UX + testing setup. |
| **Two days** | Tier 1 + Tier 2. All "biggest leverage" items + the polish cleanups. |
| **Week** | Tier 1 + 2 + 3 + 4. Everything pending except deferred-by-design. |

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
  - `npm test` passes (current baseline: 168)
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

Number continues from the highest existing `N` (start at N22 — N21 is the
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

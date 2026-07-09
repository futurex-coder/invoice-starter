# Performance Audit — Round 2: Requests, Routing & Page Mounting

**Branch:** `perf/audit-p1-p5` · **Worktree:** `C:\invoice-starter-perf` (SSD)
**Follows:** [PERFORMANCE_AUDIT_PLAN.md](PERFORMANCE_AUDIT_PLAN.md) (P1–P5)
**Status legend:** ☐ todo · ◐ in progress · ☑ done

---

## Why the app makes "so many API requests" — the sources

Traced every client fetch / server-action call / prefetch. Four generators:

### R1 — `/api/user` refetched on every mount **and** every window focus
`useCurrentUser()` = `useSWR('/api/user', fetcher)` with **no config**, so it
inherits SWR's defaults: `revalidateOnFocus`, `revalidateOnReconnect`, and
`revalidateIfStale` all **true**. The root layout already seeds the value via an
SSR `fallback` (`getUser()`), yet SWR still:
- fires a background `GET /api/user` on mount (stale-while-revalidate), and
- fires another **every time the window regains focus** (alt-tab, tab switch).

Each hit runs `getSafeUser()` → a DB round-trip. Consumers: `UserMenu` +
`NotificationsBell` (dedup to 1 key). Net: a steady drip of `/api/user` calls that
carry **no** new information — the user identity is fixed for the session.

### R2 — Notifications poll every 60 s + on focus
`NotificationsBell` → `useActionSWR('notifications', getNotifications,
{ refreshInterval: 60_000 })`. No focus override → **also** refetches on focus.
Each call is a server-action POST that re-runs `requireUser()` (auth + DB) plus the
notifications query. Runs on **every** page (the bell is in the persistent header).

### R3 — Every list page fetches on the client **after mount** (waterfall)
`invoices`, `partners`, `articles`, `received-invoices` pages are all
`'use client'` and load data through `useListPageState` → `useActionSWR` →
a **server action fired on mount**. Sequence per navigation:
1. Server sends an essentially empty shell (table in `loading` state).
2. Browser downloads/hydrates JS.
3. **Only then** the server action POST fires to fetch page 1.
4. Rows render.

That's an extra client→server round-trip *after* navigation, and the data doesn't
even start loading until JS hydrates — the visible "page mounting" lag. It also
re-runs `requireCompanyAccess()` (now `cache()`-deduped, but still a fresh request).

### R4 — `<Link>` prefetch fan-out
The App Router prefetches every in-viewport `<Link>`. The dashboard renders ~14
links (nav + quick links + activity), each triggering a prefetch RSC request. This
is mostly **beneficial** (snappy nav) and cheap under PPR (prefetches the static
shell), so we keep it — documented here so it's not mistaken for a leak.

---

## Fixes (prioritized by impact ÷ effort)

### T1 — Kill redundant SWR revalidation (fixes R1, R2 focus-spam)  ☑ DONE — High / low
Set sane **global** defaults in the root `SWRConfig`:
```ts
revalidateOnFocus: false,
revalidateOnReconnect: false,
revalidateIfStale: false,
dedupingInterval: 5000,
```
- `/api/user`: SSR fallback is authoritative for the session → **zero** background
  refetches. Sign-out already calls `mutate('/api/user')` explicitly; we add the
  same to the profile-update success path so the header stays correct without
  focus-revalidation (**T1a**).
- Notifications: `refreshInterval` is independent of these flags, so the 60 s poll
  still works — we just stop the redundant focus refetch.
- Lists: mutations already refetch via `runMutation`'s `mutate()`; losing
  focus-revalidation is fine and removes a burst of POSTs on every alt-tab.

**Impact:** removes essentially all "idle"/focus-triggered requests. On a machine
that alt-tabs a lot, this is the difference between a request every few seconds and
none.

### T2 — Server-seed list pages so they render on first paint (fixes R3)  ◐ invoices DONE — High / med
Give each list page an SSR-fetched first page as SWR `fallbackData`, so the default
view renders immediately with **no mount POST**:
1. Add an optional `fallbackData` to `useListPageState` → forwarded to `useSWR`.
2. Convert each list `page.tsx` into a thin **server** component that calls the
   list action for the default filters/page-1 on the server and passes the result
   as `fallbackData` to a `'use client'` child (the current page body).
3. With `revalidateIfStale:false` (T1), SWR uses the seed and does not refetch on
   mount. Filters/pagination still fetch new keys client-side exactly as before.

Rollout: **invoices** first (flagship, fully verified), then **partners**,
**articles**, **received-invoices** using the identical recipe.

**Impact:** list content is present in the SSR HTML — no empty→hydrate→POST→rows
waterfall. One fewer round-trip per list navigation and meaningful TTI/perceived-
speed improvement, especially on cold JS.

### T3 — Notification poll cadence  ☐ Low / low
Keep 60 s (acceptable) but ensure it's paused when the tab is hidden (SWR default
`refreshWhenHidden:false` already does this — verified, documented). No code change
unless we later want a longer interval.

---

## Verification plan
- `type-check`, `lint`, `vitest` (250), `next build` all green.
- Confirm `/api/user` no longer refetches on focus (network trace / reasoning).
- Confirm each seeded list route ships rows in the SSR HTML (`next build` output +
  runtime check that the table is populated without a mount POST).

## Results

**T1 (SWR revalidation) — done.** Root `SWRConfig` now sets
`revalidateOnFocus/Reconnect/IfStale: false` + `dedupingInterval: 5000`. Effect:
`/api/user` and list SWR keys no longer refetch on mount/focus/reconnect. The
only remaining automatic client requests are the notifications `refreshInterval`
(60 s, paused when the tab is hidden). Idle/alt-tab request storms → eliminated.
- **Bonus security fix:** the root SWR `fallback` seeded `/api/user` with the
  **full** user row (incl. `passwordHash`), which is serialized to the client.
  Switched to `getSafeUser()`. Verified live: `GET /api/user` body has no
  `passwordHash`.
- **T1a:** profile-update success now calls `mutate('/api/user')` so the header
  stays correct without focus-revalidation.

**T2 (list SSR seeding) — invoices done, verified live.** `/c/5/invoices` now
returns **8 invoice rows in the SSR HTML** (verified with a real session; the
empty-state markup is absent). Before, the `'use client'` page shipped an empty
loading table and fetched rows via a server-action POST only after hydration.
Infra added: `useListPageState({ fallbackData })` (applied only for the default
view) + a shared `queryInvoicesList(companyId, filters)` so the action and the
server page return an identical shape. Seeds by URL companyId (not the cookie).

Remaining lists (**partners, articles, received-invoices**) follow the exact same
recipe — tracked below.

**Verify quad (branch `perf/audit-p1-p5`):** `tsc` 0 errors · `eslint` 0 warnings
· `vitest` 250 passed · `next build` success (routes still `ƒ`/`◐` as expected).

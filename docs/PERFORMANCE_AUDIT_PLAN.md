# Performance Audit & Fix Plan (P1–P5)

**Branch:** `perf/audit-p1-p5` · **Worktree:** `C:\invoice-starter-perf` (SSD)
**Date:** 2026-07-09 · **Status legend:** ☐ todo · ◐ in progress · ☑ done

---

## Executive summary

The app "felt like 1999" almost entirely because of **Next.js dev cold-compile
time**, and the dominant cause was **the repo living on a spinning HDD (`D:`)**.
The database and query layer are healthy and were *not* the bottleneck.

### Measured — cold compile (first visit to a route in a dev session)

| Route      | HDD `D:` (before) | SSD `C:` (after) | Speedup |
|------------|------------------:|-----------------:|--------:|
| `/`        | 88.0 s            | 3.0 s            | ~29×    |
| `/sign-in` | 19.5 s            | 0.68 s           | ~29×    |
| `/pricing` | 55.9 s            | 1.8 s            | ~31×    |
| dev server "Ready" | 6.6 s     | 0.63 s           | ~10×    |

Next.js emitted **"Slow filesystem detected (301 ms benchmark)"** on `D:`; the
warning is gone on `C:`. Warm navigations were always fast (~0.2 s) on both.

### Runtime facts (survive into production)
- Raw pooler round-trip: **~31 ms/query** (`eu-central-1`, transaction pooler, `prepare:false`).
- Largest app table `activity_logs` = **145 rows**; `invoices` = 15. DB is tiny.
- Indexing is **thorough** — every `company_id` filter, composite, and FK is indexed.
- RLS is **not** in the request path (Drizzle connects as the Postgres role via the pooler).

---

## P1 — Repo on HDD → move working copy to SSD  ☑ DONE (High impact, low effort)

**Root cause (measured, not guessed):** `D:` is Disk 0 = **HDD** (ST2000DM008,
7200 rpm); `C:` is a Kingston **NVMe SSD**. Turbopack does thousands of tiny
random reads per compile — pathological on a spinning disk.

**What was done:**
- Created this worktree on the SSD (`C:\invoice-starter-perf`) — the working copy
  now compiles ~30× faster. This *is* the fix, demonstrated with real numbers above.
- Added [`scripts/dev-perf-setup.ps1`](../scripts/dev-perf-setup.ps1): run **as
  Administrator** to add Windows Defender real-time-scan exclusions for the repo,
  `.next`, `node_modules`, and `node.exe` (secondary win on top of the SSD).

**Action for the user (outside this repo, can't be automated from here):**
- Long term, keep the *primary* checkout on `C:` (the SSD), not `D:`. The `D:`
  HDD checkout will always be slow no matter what else we change.
- Run `scripts/dev-perf-setup.ps1` once (elevated) to remove AV scan overhead.

---

## P2 — `cacheComponents: true` compile overhead  ☑ DONE — KEEP ON (measured)

Measured on the SSD, cold, `optimizePackageImports` on, `.next` cleared between runs:

| Route      | cacheComponents ON | cacheComponents OFF | Δ       |
|------------|-------------------:|--------------------:|--------:|
| `/`        | 2.88 s             | 2.72 s              | ~0.16 s |
| `/sign-in` | 0.70 s             | 0.65 s              | ~0.05 s |

**Decision: keep `cacheComponents: true`.** After the SSD move it costs ≤0.2 s of
cold compile (inside run-to-run noise), while it actively powers Partial
Prerendering (the `◐` routes in `next build`) and `pricing/page.tsx`'s
`use cache`. Disabling it would sacrifice PPR/streaming and force a pricing
migration for a negligible, noise-level gain. Not worth it.

---

## P3 — Redundant serial auth round-trips  ☑ DONE (Med impact, low effort — prod-facing)

`getUser()` ran 3–4×/render (root-layout SWR fallback + company layout + page +
client `/api/user`) and `verifyCompanyAccess()` 2×, each a serial ~31 ms
round-trip, because neither was memoised per-request.

**Done:** wrapped `getUser` ([lib/db/queries/auth.ts](../lib/db/queries/auth.ts)),
`getActiveCompanyId`, and `verifyCompanyAccess`
([lib/db/queries/companies.ts](../lib/db/queries/companies.ts)) in React
`cache()`. React keys the cache per-request, so duplicate calls within one render
now hit memory instead of the pooler — collapsing ~6 serial round-trips → ~2
(~120–150 ms saved per authenticated navigation, in production too). Zero
behaviour change; verified by type-check + 250 passing tests + clean prod build.

---

## P4 — `radix-ui` / `lucide-react` barrel imports  ☑ DONE (Med impact, low effort)

10 files import the unified `radix-ui` package; not in Next's default
`optimizePackageImports`. **Done:** added
`experimental.optimizePackageImports: ['radix-ui', 'lucide-react']` to
[next.config.ts](../next.config.ts).

- Cold-compile delta at this app's size: within noise (~0.1 s) — expected, since
  the SSD already dominates. Its real payoff is **smaller client bundles** in
  production (only the used sub-modules ship instead of the whole barrel), which
  helps real navigation/TTI on deployed builds. Kept for that reason.

---

## P5 — Deploy region alignment  ☑ DONE (prod-only, config)

DB is in `eu-central-1`. A serverless deploy in another region turns every 31 ms
round-trip into 150 ms+ (and P3's savings would be dwarfed). **Done:** added
[vercel.json](../vercel.json) pinning `regions: ["fra1"]` (Frankfurt =
`eu-central-1`). If deployed on a non-Vercel host, set that platform's region to
Frankfurt/eu-central-1 the same way.

---

## Not problems (ruled out with evidence)
- Query layer: `Promise.all` fan-out, SQL-side aggregation, column narrowing,
  joins (no N+1), `.limit()`/pagination. No hot-path `select('*')`.
- DB indexes / schema / RLS: nothing to change at this scale.

## Security aside (not perf)
Live Stripe / Claude / Supabase service-role keys sit in `.env`. Rotate if that
file was ever shared or committed.

---

## Verification (all green on `perf/audit-p1-p5`, SSD worktree)

- `tsc --noEmit` → 0 errors
- `eslint .` → 0 warnings
- `vitest run` → **250 passed** (incl. the DB integration suite)
- `next build` → success; company routes show `◐` Partial Prerender (PPR intact)
- Dev runtime: `/`, `/sign-in`, `/pricing`, `/sign-up` all 200, no console/server errors

**Final cold-compile, final config (SSD + P3 + P4, cacheComponents on):**

| Route      | HDD before | SSD after | warm |
|------------|-----------:|----------:|-----:|
| `/`        | 88.0 s     | 2.99 s    | 0.17 s |
| `/sign-in` | 19.5 s     | 0.71 s    | 0.10 s |
| `/pricing` | 55.9 s     | 1.82 s    | —    |
| server ready | 6.6 s    | 0.57 s    | —    |

**Net:** the "1999" feeling is gone — the ~20–90 s per-route compile cliff is now
~0.5–3 s (~30×), and authenticated navigations shed ~120–150 ms of redundant DB
round-trips that also carry into production.

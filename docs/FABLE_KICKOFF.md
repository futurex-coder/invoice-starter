# Fable Overnight Run — Execution Playbook

> **You are running unattended (overnight).** Follow this playbook exactly. Build Invoicly per
> the roadmap, verify EVERYTHING by running the app, commit each verified item, log questions to
> `docs/REVIEW_QUEUE.md`, and never stop to ask. Keep going until all unblocked work is done.

---

## 0. Model & resilience
- **Primary:** Fable 5. **Auto-fallback:** Opus 4.8 (`fallbackModel` in `.claude/settings.json`) —
  if Fable is overloaded/unavailable/quota-exhausted, work continues on Opus 4.8 automatically with
  the **same protocol**. Do not change the process when the model switches.
- **Permissions:** god mode (`bypassPermissions`) — never wait on a prompt.
- If a tool is genuinely denied (e.g. `git push --force`, filesystem-wipe), that's intentional →
  log to `REVIEW_QUEUE.md`, never work around it.

---

## A. INFORMATION — read before writing any code (in order)
1. `.claude/CLAUDE.md` — working contract (autonomy, verify-by-running, strict TS, commit discipline).
2. `docs/PRODUCT_CONTEXT.md` — what/why + MVP (§4, §11). Every item must serve something here.
3. `docs/PRODUCT_ROADMAP.md` — items, the four-gear model, the **decisions register (§2)**.
4. `docs/REFACTOR_BACKLOG.md` — the refactor to finish first (§5).
5. `docs/REVIEW_QUEUE.md` — OPEN decisions; do NOT block on these.
6. `docs/knowledge/*` — findings so far (incl. `nap-compliance.md` stub).
7. `docs/adr/0001-*` (action/auth contract) + `docs/migrations.md` (Drizzle workflow).

**Before each item** also gather local context: read the exact files it touches, understand the
existing pattern (find a sibling that did the same thing), check `lib/db/schema.ts` for the data
model, and skim `git log` for how similar items were shipped. Never code against assumptions you
can cheaply verify.

---

## B. IMPLEMENTATION — per-item protocol (repeat for every item)
1. **Pick the next unblocked item** in the order in §D. If it's gated on an OPEN decision
   (register §2 / REVIEW_QUEUE), do the parts that don't need the decision, log the rest, and move on.
2. **Load the matching skill** (roadmap §10 table): `senior-frontend` / `senior-backend` /
   `senior-data-engineer` / `tdd-guide` / `senior-security` (auth+email) / `engineering:architecture`
   (ADRs) as appropriate.
3. **Plan first for non-trivial items** — use plan mode: state the approach, list the files you'll
   touch, the edge cases, and the acceptance check, then proceed. Trivial fixes skip this.
4. **Break into `TaskCreate` steps** and track them.
5. **Implement** to the existing conventions + strict TS (no `any`, no `as`-casts, no `@ts-ignore`).
   - Schema change → edit `lib/db/schema.ts` → `npm run db:generate` → **review the SQL** → commit the
     migration + snapshot together. Renames need hand-edited `RENAME COLUMN` (see `migrations.md`).
   - New server action → `action()` wrapper + `requireCompanyAccess()` (ADR-0001). New API route →
     `withApiAuth`. New form → `<FormField>` + `validationErrors`.
6. **Verify — run the full §C protocol.** Do not skip it.
7. **Update the living docs in the SAME commit**: tick the roadmap/backlog item, append to the "done"
   table, save any finding to `docs/knowledge/`, and log any new issue you spotted (new N-item).
8. **Commit atomically** with a descriptive message + `Co-Authored-By: Claude Opus 4.8` trailer.
   **Local commit only — never push or open a PR.**
9. Go to the next item.

---

## C. VERIFICATION — do ALL of this before every commit
**C1 — Static (must all pass):**
- `npm run type-check` — clean
- `npm run lint` — 0 warnings
- `npm test` — ≥ baseline (222 after run 1, 2026-07-08)
- `npm run build` — when routes / config / deps / schema changed

**C2 — Run it (this is mandatory, not optional):**
- Start a preview: `preview_start "dev"` (config in `.claude/launch.json`).
- **Exercise the exact thing you changed AND the flow around it** — click through it like a user.
- Check, every time:
  - correct **data** and correct **totals / aggregates**
  - **no console errors** → `preview_console_logs level=error`
  - **no failed network requests** → `preview_network filter=failed`
  - **layout intact at desktop AND mobile** → `preview_resize` (mobile matters — owners are on mobile)
- For **money / VAT** features: reconcile the number **by hand** against known inputs.
- For **flows**, drive the whole flow, not just the changed screen:
  create-draft → finalize → credit-note · received-invoice upload → AI-extract → review → confirm →
  save-as-partner · payments · copy / cancel · a **foreign supplier** (US, no EIK) · a **mixed-currency**
  document.

**C3 — Edge cases:** empty state, very large input, mixed currency, cancelled / credit-noted doc,
foreign supplier without EIK, concurrent edit, permission boundary (accountant vs owner).

**C4 — Self-correct loop:** if ANYTHING is wrong, broken, or even *feels off/strange* →
**do not commit**. Re-read your own code, find the **root cause** (not a band-aid), fix it, and
re-run C1–C3. Repeat **build → run → observe → fix** until you're genuinely confident. Passing tests
is the floor, never the finish line.

**C5 — Non-visual logic** (server actions, parsers, aggregations): prove it with a focused test or a
real DB round-trip and **assert** the output — do not eyeball the code.

**C6 — Self-review the diff:** re-read your own change — does it match intent? any regression? any
leftover debug/console code? any TS-rule violation? Only then commit. Stop the preview when done
(`preview_stop`) if you won't reuse it.

---

## D. AUTONOMY — running till morning
> **Status after run 1 (2026-07-08):** the phase list below is largely shipped. Trust the
> roadmap's ticked items / done tables + `REFACTOR_BACKLOG.md` session state over this list.
>
> **⭐ Run-2 direction (owner, 2026-07-08) — POLISH, and DEFER email + auth:**
> 1. **ASYNC-SCAN** (PRODUCT_ROADMAP Phase 1.5) — TOP priority. Non-blocking parallel expense
>    scanner: upload → rows appear instantly → parallel background analysis → auto-saved as
>    draft → click to review / open the file. Build end-to-end in its spec order.
> 2. **RV-3** — review-screen redesign (Phase 5), right after ASYNC-SCAN.
> 3. Remaining polish across the app to the §C bar (finish half-done flows, edge states).
> 4. Decision-gated items (GEN-1/D-FX, OI-3/D-CANCEL, OI-10 outgoing/D-EDIT) only if the owner
>    has answered `REVIEW_QUEUE.md`.
> **Do NOT build:** AUTH-1 (Phase 6), EMAIL-1/2 (Phase 7), BULK-1 — all DEFERRED this phase.

**Original order of work** (run-1 history; respect dependencies; skip decision-blocked parts):
1. **Phase 0 — finish refactor:** N23 (ReviewForm perf) → N22 (PPR/cacheComponents + middleware→proxy)
   → N15 (invoice-lifecycle integration tests). Keep everything green.
2. **Discover:** RESEARCH-1 (competitor feature+functionality research → `knowledge/competitor-invoicing.md`,
   use parallel subagents) + FUNC-AUDIT (drive existing flows in a preview, catalog gaps → new items).
3. **Phase 1 quick wins:** OI-2 (fix Copy), NI-2 (remove customer note), RV-2 (remove due date),
   NI-1 (preview/finalize without draft), OI-8 (clickable links), RV-4 (save-partner with just a name).
4. **Money plumbing (correctness first):** OI-1 (accounted column + migration) → DASH-1 (aggregation
   audit) → GEN-1 (currency, needs D-FX — do the non-decision parts, log the rest).
5. **Core value on top of the plumbing:** VAT-1 (VAT paid vs received view), TRANS-1 (notifications),
   TRANS-2 (what's-left-this-month), OI-9 (simplified lists + inline paid/accounted), OI-4/OI-5
   (filters), OI-7 (expandable rows), OI-10 **received-side only** (outgoing-finalized waits on D-EDIT).
6. **Review redesign:** RV-3 (rebuild the review screen) incl. RV-1 (scan viewer).
7. **Navigation:** MENU-1 (horizontal header + tab consolidations).
8. **After AUTH-1 + EMAIL-1 land:** OI-11 (All view — can start earlier), BULK-1 (row-select + Gmail bulk email).
9. Then everything else on the roadmap in dependency order.

**Rules for the run:**
- **Never stop to ask.** Log every decision/blocker to `REVIEW_QUEUE.md` (use its template) and continue
  with a reversible default (noted) or skip to the next item. One blocked item never stalls the run.
- **Always keep a next actionable item.** Do not end a phase and wait — roll straight into the next.
- **Decision-gated items** (D-CANCEL, D-FX, D-EDIT, D-AUTH, D-EMAIL, NAP-DOC): build what doesn't need
  the decision; log the decision-dependent remainder.
- **NAP-1 / compliance:** blocked on the PDF content (NAP-DOC). Do the baseline items from
  `knowledge/nap-compliance.md` that are clearly correct (e.g. verify existing mandatory fields); log
  the rest for the owner.
- Model switch (Fable→Opus 4.8) changes nothing about the process.

**Only stop when** (a) all unblocked work is done, or (b) everything left is decision-blocked. Then do §E.

---

## E. MORNING HANDOFF (what the owner wakes up to)
- A **clean git log** of atomic, verified commits on the feature branch (nothing pushed).
- `REVIEW_QUEUE.md` updated with **every** decision/blocker you hit + the reversible default you took.
- Living docs ticked; findings in `docs/knowledge/`.
- A **final chat summary** grouping: ✅ shipped · 🟡 blocked-on-decision (with the exact question) ·
  🔎 new findings/issues added · ➡️ suggested next pickup. Keep it short and scannable.
- Do **not** push or open a PR — that's the owner's call.

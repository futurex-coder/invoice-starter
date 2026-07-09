# Overnight run plan — GEN-1 + UI/UX simplification (2026-07-08 → morning)

> Autonomous run. God-mode protocol (`FABLE_KICKOFF.md` §B/C/D): verify every item by
> running, commit atomically (local only, never push), log decisions to `REVIEW_QUEUE.md`,
> never block, leave the §E morning handoff. Base branch: `claude-run-1.9`.

> **STATUS (morning):** Block A (GEN-1) ✅ **fully shipped + hand-reconciled** (A1–A5).
> Block B ✅ **started** — FX-input removal, clickable dashboard shortcuts, UX audit doc
> (`knowledge/ux-audit-2026-07.md` holds the ranked remaining backlog). See §E handoff in chat.

## Block A — GEN-1: one company currency, everything converts to it (money-critical)
Order (each slice: build → verify by running / hand-reconcile → commit):
- **A1. FX service** (`lib/fx/`): `convert(amount, from, to)` via EUR cross-rate. BGN↔EUR is the
  **fixed** euro-adoption rate **1.95583** (not ECB); other currencies (USD…) use **ECB daily**
  reference rates, fetched + cached daily. Pure conversion math unit-tested; ECB fetch isolated
  + defensively cached (fall back to last-known / identity on fetch failure — never crash a page).
- **A2. Freeze the rate at finalize**: when a document is issued, stamp `fxRate` =
  rate(doc currency → company base) onto it, so historical totals never drift. Touches
  `finalizeInvoice`, `createInvoiceDraft(finalizeImmediately)`, `createNoteFromInvoice`, and the
  received-invoice confirm path. Define `fxRate` canonically as **amount_base = amount_doc × fxRate**.
- **A3. Convert in aggregations** — `lib/db/queries/money.ts` is the single insertion point
  (its header says so): multiply each doc's amount by its `fxRate` before summing, so every
  total is in the company base currency. Propagate to dashboard + VAT summary.
- **A4. Fix the wrong sums + drop banners**: cross-company dashboard `SummaryGrid` currently
  sums raw across currencies and hardcodes " EUR" (600 BGN + 12 EUR → "612 EUR" bug). Convert to
  base. Remove the now-unnecessary mixed-currency banners (VAT page, dashboard).
- **A5. Settings = the one place**: reframe `companies.defaultCurrency` in settings as **the
  company currency** ("everything is shown in this"), not just a new-doc default. New invoices
  default to it; received/foreign docs keep their own currency but display converted.
- Verify: hand-reconcile a mixed EUR/BGN/USD ledger to the base; integration test in `money`.

## Block B — UI/UX simplification (clear, fewer clicks)
- **B1. Audit** the main flows in parallel subagents → a ranked friction list (too many clicks,
  unclear labels, redundant steps, weak empty states). Capture in `knowledge/ux-audit-2026-07.md`.
- **B2. Ship** the high-impact, low-risk simplifications one commit at a time. Candidates
  (confirm/adjust from the audit): fewer clicks to create/scan/review; clearer primary actions;
  better empty/loading states; consolidate redundant controls; consistent money/date formatting;
  sensible defaults so common paths need no configuration.

## Block C — close out
- Full verify quad; re-reconcile money; tick living docs; `REVIEW_QUEUE.md` updated;
  §E morning handoff in chat (✅ shipped · 🟡 blocked-on-decision · 🔎 findings · ➡️ next).

## Guardrails
Local commits only. No push/PR. No external sends. Strict TS. Preview harness wedges on heavy
client pages (documented) → verify server/DB logic via tests + SQL; treat build-green +
type-check as the floor for presentational changes.

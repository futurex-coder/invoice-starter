# FUNC-AUDIT — functional audit of the existing flows (2026-07-08)

> End-to-end drive of the core flows against the real dev DB (UI clicks where the
> preview allowed, action-layer probes elsewhere + SQL reconciliation). Supports
> **FUNC-AUDIT**; feeds DASH-1, GEN-1, OI-*, AGG-1, PAY-1. Numbers below reconciled
> by hand on 2026-07-08 dev data.

## Verdicts by flow

| Flow | Verdict | Evidence |
|---|---|---|
| create draft → finalize → cancel | ✅ works, transition-guarded | N15 suite (14 tests, real DB) |
| credit/debit note from finalized invoice | ✅ **after two fixes** | was broken twice: (1) numbering violated the DB trigger (fixed in N15); (2) notes inherited the parent's supplyDate so any parent >5 days old failed `ISSUE_DATE_TOO_LATE` (fixed in `acdaad6`; CN id 43 created via real UI click → DB verified) |
| received review → confirm → partner-link | ✅ works | action-layer drive of RI 8 (co. 5): status → confirmed, partner "FutureX" auto-created (id 19) + linked, activity logged |
| re-confirm of a confirmed received invoice | ✅ by design | it's the edit path — `confirmedAt` preserved (`wasAlreadyConfirmed`), patch re-applied. Only nuance: activity logs a 2nd CONFIRM rather than an UPDATE |
| payments | ⚠️ coarse by design | no payments table at all — `paymentStatus` enum on the doc is the whole model; `/payments` page covers the **received side only** (toggle + to-pay list). No amounts/dates/methods per payment, so `partial` is a label, not a number → PAY-1 candidate |
| copy invoice | ❌ known-unwired | `onCopy={() => {}}` — OI-2 fixes it |
| permission boundary | ✅ enforced server-side | `lib/auth/permissions.ts`: settings/delete/transfer/remove = owner-only; invite = both roles; invoices = both. Checks live in the actions (invoicing/actions.ts:113, 536, 553, 722, 752), not just UI |
| cross-company scoping | ✅ | N15 suite (read + mutate return "Invoice not found") |

## Money-aggregation findings (the big ones)

Dev-data reconciliation, company 5 (Алфа Консулт, default EUR, all docs BGN):

| Dashboard shows | Reality in DB | Why |
|---|---|---|
| Revenue **1,920.00 EUR** | 1 paid invoice **1 920 BGN**, with a **480 BGN credit note (paid)** against it → net **1 440 BGN** | ① sums are currency-blind and get labelled with `defaultCurrency`; ② credit/debit-note **amounts** never subtract (only counted) |
| Outstanding **600.00 EUR** | 1 unpaid invoice 600 BGN with a **600 BGN CN** against it → net **0** | same two causes |
| Cross-company Outstanding **612.00 EUR** | 600 **BGN** (co. 5) + 12 **EUR** (co. 9) added raw | different currencies added as bare numbers |

Additional code-level holes in `app/(dashboard)/c/[companyId]/dashboard/_components/queries.ts`:

1. **`paymentStatus = 'partial'` is invisible** on the invoice side — `revenue` counts only `paid`, `outstanding` counts only `unpaid`; a partially-paid invoice appears in **neither** (and not in `overdueCount`). The received side is consistent (`<> 'paid'` ⇒ partial counts as outstanding). No partial rows exist in dev yet, so the dashboards happen to look right today.
2. **Credit/debit notes**: counted (`creditNotes`/`debitNotes`) but their amounts affect no money bucket anywhere.
3. Notes carry a meaningless default `paymentStatus='unpaid'` (what does an "unpaid credit note" mean?) — decide note payment-semantics when fixing AGG-1.
4. `revenue` = paid-only is a *cash* view labelled as "revenue" (accrual would count finalized). Fine as a product choice — document it in DASH-1's rules.

**Fixability:** #1 #2 #3 need **no product decision** (AGG-1) — only the FX conversion (currency-blind sums) waits on D-FX/GEN-1.

## Environment note — preview-harness wedge, root-caused

The "unresponsive preview" from the N15 session (REVIEW_QUEUE: PREVIEW-ENV) is **rAF
starvation in the occluded preview tab**: Next 16 streams Suspense completions that
React reveals via `requestAnimationFrame` batching (`$RB` queue + `$RV` reveal fn);
an occluded/backgrounded tab gets no animation frames, so full-document loads sit on
the static shell forever and client hydration/data fetches lag. Workarounds that make
it usable (in order): ① take one `preview_screenshot` (forces the compositor to
produce frames — un-sticks everything); ② `preview_eval`: flush `window.$RB` through
`window.$RV` and shim `requestAnimationFrame` → `setTimeout(cb, 16)` (per document —
dies on navigation); ③ prefer client-side navigation over full-document loads; ④ for
data assertions skip the UI entirely (action-layer probes + SQL, as this audit did).

## New items raised

- **AGG-1** — fix partial-payment + credit-note holes in aggregates (no decision needed) — *added to roadmap Phase «money plumbing»*.
- **PAY-1** — real payment ledger (amount/date/method per payment, M:N invoice
  allocation à la inv.bg/Invoice Ninja — model in `competitor-invoicing.md` §5) — post-MVP candidate.
- (cosmetic) re-confirm of received invoice logs CONFIRM instead of UPDATE — fold into TRANS-1's activity work.

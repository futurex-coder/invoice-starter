# Knowledge Base

Persistent, cross-session knowledge for this project. Anything a future session would
be glad someone wrote down goes here — so we never re-learn the same thing twice.

## What belongs here
- **Research** — competitor analysis, library/API evaluations, "how does X work" write-ups.
- **Findings** — non-obvious facts discovered while working (a schema quirk, a gotcha in
  a dependency, why a thing is done a certain way).
- **Audits** — e.g. the money-aggregation-rules map (DASH-1), inventories of where a
  pattern is used.
- **Decision context** — the reasoning behind a decision, longer than fits in a doc's
  decisions register. (The decision *itself* also goes in the relevant living doc's
  register + memory.)

## What does NOT belong here
- Architecture Decision Records → `docs/adr/`.
- The living plans → `docs/REFACTOR_BACKLOG.md`, `docs/PRODUCT_ROADMAP.md`.
- Session-scoped todos → the harness Task list (they die with the session).
- Secrets, tokens, credentials → never commit these anywhere.

## Conventions
- One topic per file, kebab-case: `competitor-invoicing.md`, `money-aggregation-audit.md`,
  `fx-rate-sources.md`.
- Start each file with a one-line summary + the date it was written (dates get stale —
  say when a finding was true).
- Link back to the roadmap/backlog item it supports (e.g. "supports RESEARCH-1 / OI-7").
- Update or delete a file when its finding is superseded — stale knowledge is worse than none.

## Index
_(add a line per file as you create them)_
- [nap-compliance.md](nap-compliance.md) — NAP/НАП requirements (STUB — source PDF not yet extracted). Supports NAP-1.
- [competitor-invoicing.md](competitor-invoicing.md) — how inv.bg/fakturi.bg/Microinvest + Stripe/Xero/QBO/FreshBooks/Zoho/Invoice Ninja actually work, by capability; data-model lessons + gap list. Supports RESEARCH-1, OI-*, GEN-1, RV-3, VAT-1, D-CANCEL/D-EDIT/D-FX. (2026-07-07)
- [func-audit-2026-07.md](func-audit-2026-07.md) — flow-by-flow audit verdicts, the money-aggregation holes (partial invisible, CN amounts ignored, currency-blind sums) with hand reconciliation, the preview-harness rAF wedge root cause. Supports FUNC-AUDIT, DASH-1, AGG-1, PAY-1. (2026-07-08)
- [money-aggregation-rules.md](money-aggregation-rules.md) — the canonical aggregation rules (code: `lib/db/queries/money.ts`), the map of every money-summing site, known gaps (FX, CN-vs-cancelled-parent, count-vs-amount overdue), and the invoice-11 incident note. Supports DASH-1, GEN-1, VAT-1. (2026-07-08)
- [invoice-numbering-triggers.md](invoice-numbering-triggers.md) — the two DB triggers that actually enforce invoice/note numbering (live-DB only, not in migrations); notes inherit the parent's series+number; proforma inserts are impossible. Supports N15/N24/N25, PROF-1, NAP-1. (2026-07-08)

# Product Roadmap & Feature Backlog

> **For the Fable 5 (and future) sessions.** This is the master plan for the next
> phase: fixing/improving existing flows and building new features. It's a living
> document — update item status in the same commit as the work, exactly like
> `docs/REFACTOR_BACKLOG.md`.

**Created:** 2026-07-07
**Base branch:** `main` (after `claude-run-1.8` merges). Start feature work on fresh
branches off `main`.

**Read `docs/PRODUCT_CONTEXT.md` first** — what we're building, for whom, and why. This
roadmap is the *how/when*; PRODUCT_CONTEXT is the *what/why* every item should serve.

**For an unattended / overnight run, follow `docs/FABLE_KICKOFF.md`** — the full
information → implementation → verification → autonomy protocol.

**Working discipline:** see `.claude/CLAUDE.md` "Working Process" (loaded every session)
and `REFACTOR_BACKLOG.md` §10. In short: load the matching skill, break each item into
`TaskCreate` steps, **commit your own work** on a feature branch after the verify quad
(type-check + lint + `npm test` baseline 201 + `npm run build`) passes, keep commits
atomic, tick the item here in the same commit, and record durable findings in
`docs/knowledge/`. Strict TS rules apply (no `any`, no `as` casts, no `@ts-ignore`).

**Scope note — i18n:** **out of scope for now** (removed from this phase). Keep everything
BG-specific as-is — no message catalog, no locale switch. Revisit only when a second
market is actually targeted (tracked as N19 in `REFACTOR_BACKLOG.md`, deferred).

---

## 1. How to run this phase — the four gears

| Gear | Claude features | Use for |
|---|---|---|
| **Discover** | `WebSearch`/`WebFetch`, parallel subagents (1 per competitor site), optional multi-agent **Workflow** | competitor **feature + functionality + UX** research (RESEARCH-1); money-aggregation audit (DASH-1); functional audit of existing flows (FUNC-AUDIT) |
| **Decide** | `engineering:architecture` (ADRs), `AskUserQuestion`, **memory** (persist answers) | GEN-1 currency, AUTH-1, EMAIL-1/2 |
| **Build** | **plan mode** per feature, skills (`senior-frontend`/`-backend`/`-data-engineer`/`-security`), subagents for mechanical fan-out | every item |
| **Ship** | `/security-review` (auth + email), `engineering:deploy-checklist`, Supabase MCP (migrations), Vercel MCP (deploy) | before each PR |

**Available MCP connectors in-env:** Supabase (schema/migrations), **Gmail** (fast path
for EMAIL-2 ingestion), Vercel (deploy).

**Parallelizable tracks** (independent — safe to run in separate sessions/branches):
Phase 1 quick wins · MENU-1 · RV-1 viewer. Sequence the rest per the dependency notes.

**Analyze functionality, not just UX.** Every item is assessed across five dimensions
before it's called done: (1) **UX** — layout, flow, a11y; (2) **functionality** — does the
feature actually do what it should, including the unhappy paths; (3) **data integrity** —
correct schema/constraints, no orphaned, duplicated, or lost data; (4) **edge cases** —
empty states, huge inputs, concurrent edits, mixed currencies, cancelled/credit-noted docs;
(5) **money correctness** — every total and aggregate reconciles. A pretty screen that
computes the wrong total is a failure, not a win. And per `.claude/CLAUDE.md`, a feature is
not done until its behavior is **verified by actually running the app**, not just by passing
type-check/lint/tests.

---

## 2. Decisions register — lock these before building the dependent item

| ID | Decision | Status | Recommendation |
|---|---|---|---|
| **D-CANCEL** | How should invoice Cancel behave? (OI-3) | ❓ OPEN — **ask Koceto** | Today: mark `cancelled`, immutable, reverse via credit note. Confirm what's actually wrong; save his answer to memory. |
| **D-EDIT** | Can **finalized/cancelled outgoing** invoices be edited? (OI-10) | ❓ OPEN — **compliance** | BG law: a finalized фактура is a sequential legal document, immutable, corrected via credit note. "Edit anything" for outgoing finalized breaks that + the unique-number guarantee. Received invoices (your own records) can be freely editable — no legal issue. Options: (a) drafts-only editable (≈today); (b) finalized editable with version history + audit trail; (c) finalized editable but auto-issues a correction doc. Needs your decision before OI-10. |
| **D-FX** | FX rate source for currency conversion (GEN-1) | ❓ OPEN | ECB daily reference rates (free, EUR-authoritative); cache daily; **freeze the rate onto each document at finalize** so historical totals never drift. `invoices.fxRate` + `receivedInvoices.fxRate` columns already exist. |
| **D-AUTH** | Adopt an auth library or extend hand-rolled `jose` sessions? (AUTH-1) | ❓ OPEN | ADR comparing Auth.js (NextAuth v5) vs. lightweight `arctic` + existing `users` table. `/security-review` mandatory. |
| **D-EMAIL-SEND** | SMTP transport for outbound (EMAIL-1) | ❓ OPEN | Already have `nodemailer` + `sendInvitationEmail`. Pick a provider (Resend/Postmark/SES) for deliverability. |
| **D-EMAIL-READ** | Scope of "look over all emails" (EMAIL-2) | ❓ OPEN | Scope to **invoice-relevant emails auto-matched to partners**, not a full mail client. Gmail API (OAuth) over IMAP if users are on Gmail; the Gmail MCP connector can prototype. |

---

## 3. Phased roadmap

Effort: **S** ≤ half day · **M** ~1–2 days · **L** > 2 days / needs ADR.

### Phase 0 — Finish refactor + merge
Ship N23, N22, N15 (see `REFACTOR_BACKLOG.md` §5), PR `claude-run-1.8` → `main`.
Feature work starts off a clean `main`.

---

### Phase 1 — Quick wins (no decisions, low risk, ship fast)

**OI-2 — Fix Copy invoice** · S · *bug*
- Copy is unwired: `onCopy={() => {}}` at `app/(dashboard)/c/[companyId]/invoices/page.tsx:172`.
- Behavior = "new invoice pre-filled from source": clone partner + line items + currency +
  payment method + VAT mode; **reset** `issueDate`/`supplyDate`/`dueDate` to today; assign a
  fresh `number` = last invoice number + 1 (via existing `getNextInvoiceNumber`); status
  `draft`; drop the source's finalized snapshots.
- Impl: route to `/c/[id]/invoices/new?copy=<sourceId>` and hydrate the new-invoice
  reducer from the source (mirrors the existing `?edit=` path). Do **not** copy the number
  from the source.
- Accept: copying a finalized invoice lands on a fresh draft with today's dates + next number.

**NI-2 — Remove customer-visible note** · S
- Drop the customer note field from the new-invoice form (`customerNote` column stays for
  historical rows; just stop surfacing/collecting it). Keep `internalComment`.

**RV-2 — Remove due date from received-invoice review** · S
- Remove the `dueDate` field from `ReviewForm.tsx` (confuses users) **and** trim the AI
  extraction prompt/schema so it stops extracting `due_date` (`app/api/invoices/extract/*`).
- Accept: due date no longer shown or requested; extraction confidence unaffected on other fields.

**NI-1 — Preview + Finalize without saving a draft first** · M
- Today Preview/Finalize are gated behind saving a draft. Allow both from unsaved state:
  Preview renders from current form state; Finalize does an implicit create-then-finalize in
  one action (server-side transaction) so the user never has to "Save draft" as a separate step.
- Accept: a brand-new invoice can be previewed and finalized without a manual draft save;
  draft save remains available for those who want it.

**OI-8 — Clear navigation links on the invoice list** · S
- Make invoice number, partner name, and related CN/DN references clickable links to their
  detail pages. Use the `cn()` + `<Link>` conventions already in the codebase.

---

### Phase 2 — Invoice-list UX (needs the accounted-status column first)

**OI-1 — "Accounted" status on outgoing invoices** · M · *schema*
- Outgoing `invoices` has **no** accounting-status column (received invoices do). Add
  `accounting_status varchar(20) NOT NULL DEFAULT 'pending'` (`'pending' | 'accounted'`),
  migration via `npm run db:generate`. Surface as a column/badge on the list.
- Blocks: OI-4, OI-6.

**OI-4 — Filter by accounted status** · S · *depends on OI-1*
- Add an `accountingStatus` filter to the invoice-list `useListPageState` defaults +
  server query. URL-syncs like the existing filters.

**OI-5 — Month-only filter (drop from/to)** · M
- Accountants work by month. Replace the from/to date range with a single month picker
  (year+month). Update `useListPageState` filter shape + the server query to bound on
  `issueDate` within the selected month. Keep it URL-bookmarkable.

**OI-6 — Row context-menu status setters** · M · *depends on OI-1*
- Extend `RowActionsMenu` on each invoice row with quick setters: mark paid/unpaid,
  mark accounted/pending. Each dispatches the matching action + optimistic
  `mutate(...,{revalidate:false})` (pattern from N11). Reuse `updateInvoicePaymentInfo`
  for payment; add an `updateInvoiceAccountingStatus` action.

**OI-7 — Expandable row detail** · M
- Each list row expands to a dropdown showing line items + total sum (read-only). Lazy-load
  the detail or reuse the already-loaded row snapshot. Mobile-friendly.
- *Competitor research (RESEARCH-1) informs the exact layout.*

**OI-9 — Simplify both lists + inline paid/accounted editing** · M · *UX + functionality*
- Trim both invoice lists (outgoing + received) to the columns that matter: **Number ·
  Client/Supplier · Date · Total · Paid · Accounted · Actions**. Drop the noise — e.g. the
  outgoing "Type" column, and fold the separate "Payment" column into the inline Paid control.
- **Paid** and **Accounted** are **inline-editable directly in the row** (click the pill →
  optimistic `mutate(...,{revalidate:false})`, pattern from N11). These are the two statuses
  accountants flip most; no menu or detail page needed.
- Depends on OI-1 (accounted column). **Supersedes OI-6's interaction** — inline is the primary
  path; keep a context-menu entry only as a secondary affordance.
- Verify by running: toggle paid/accounted on a real row, confirm it persists and the aggregate
  updates, at desktop and mobile widths.

**OI-10 — Edit invoices regardless of status** · M · ⚠️ *needs D-EDIT (compliance)*
- Requested: every field editable no matter draft / finalized / cancelled.
- **Received invoices** (your own records) → make freely editable at any status; no legal issue.
- **Outgoing finalized/cancelled** invoices → **do NOT implement until D-EDIT is decided.** A
  finalized BG фактура is a sequential legal document corrected via credit note; that's why the
  codebase locks it + freezes snapshots. See D-EDIT for the options.

**OI-11 — "All invoices" view** · S/M · *UX*
- The Invoices page tabs **Outgoing / Received**. Add an **All** tab (or toggle) listing every
  invoice — outgoing + received together — with a Direction column to tell them apart. Shares
  the OI-9 column set + filters. One place to see everything.

**BULK-1 — Row selection + bulk email via Google** · M · *depends on EMAIL-1 + AUTH-1*
- On **every** invoice tab (Outgoing / Received / All): a **checkbox per row** + select-all, and
  a bulk-action bar to **email the selected invoices + their info** (PDF attachments + a summary)
  via **Google/Gmail** (ties to AUTH-1 Google auth + EMAIL-1 send transport).
- Verify by running: select several rows, trigger send, confirm the email + PDFs go out and the
  UI shows per-row success/failure.

---

### Phase 3 — Money correctness (currency) ⚠️ ADR first (D-FX)

**GEN-1 — Convert every document to the company base currency** · L
- **Why P0-correctness:** aggregations/sums are wrong when invoices arrive in mixed
  currencies. Base = `companies.defaultCurrency`.
- Infra partly exists: `invoices.fxRate` + `receivedInvoices.fxRate` columns are already
  there. Gaps: (a) a reliable FX source to populate `fxRate` (D-FX → ECB), (b) freezing the
  rate at finalize, (c) converting consistently in **all** aggregations.
- Steps: ADR (D-FX) → FX fetch+cache service in `lib/` → populate `fxRate` on
  create/finalize → convert to base in every sum (list totals, dashboard, reports).
- Accept: with invoices in EUR + USD + BGN, every displayed aggregate is correct in the
  company base currency; historical totals never change when today's FX moves.
- Tightly coupled to **DASH-1**.

---

### Phase 4 — Navigation / IA restructure

**MENU-1 — Desktop horizontal header nav + consolidations** · M · *frontend*
- Desktop: move the nav into a horizontal header (mobile keeps its current pattern).
- Remove **Received invoices** from the menu.
- Merge **Activity + General + Security** into one page with tabs.
- Merge **Company + Members** into one page with tabs (shared "Company" menu item).
- Reuse existing routing; add a `<Tabs>` primitive if one doesn't exist yet.

---

### Phase 5 — Received-invoice review redesign

**RV-3 — Redesign the whole review-received-invoice screen** · L · *UX + functionality*
- The current view is cramped and hard to use. Rebuild it to be clear and easy: sensible field
  grouping (Supplier / Document / Items), the readable scan viewer (RV-1), inline validation
  that **guides rather than blocks**, and a layout that uses desktop width well and collapses
  cleanly on mobile. Absorbs RV-1, RV-2, RV-4.
- Verify by running: load a real multi-page scan **including a foreign-supplier invoice** and
  confirm the whole review → confirm flow is smooth end-to-end.

**RV-1 — Better scanned-invoice viewer** · M/L · *frontend (part of RV-3)*
- Desktop: use more screen width; show **one page at a time** with **pagination + zoom**.
- Mobile: a **bottom drawer** that shrinks/expands.
- Accept: a multi-page scan is readable on desktop and phone without the current cramped view.

**RV-4 — "Save as partner" needs only a name** · S · *functionality gap — can ship independently*
- A foreign supplier (e.g. Anysphere/Cursor — US EIN, no EIK/VAT) currently **can't** be saved
  as a partner: `createPartnerSchema.eik` requires a 9–10 digit BG EIK, so the review form shows
  blocking red errors on EIK/VAT. Fix: **make EIK + VAT optional** so "Save as partner on
  confirm" works with just a **name** (+ whatever address we have). Treat missing EIK/VAT as a
  soft note, not a blocker; keep BG-format validation only when a value is actually entered.
- Touches: `createPartnerSchema` (eik → optional/nullable), the received-invoice confirm /
  create-partner path, and the ReviewForm validation display.
- Verify by running: confirm the Cursor (US) invoice with "save as partner" ticked and see the
  partner created with just name + address, no EIK, no blocking error.

---

### Phase 6 — Google auth ⚠️ ADR (D-AUTH) + `/security-review`

**AUTH-1 — Google login + account linking** · L
- Add Google OAuth sign-in and **linking to existing accounts** (match by verified email
  to the `users` table). Current sessions are hand-rolled (`jose` + bcrypt), so this is real
  work — the ADR decides library vs. hand-roll.
- Needs: Google Cloud OAuth credentials (env), callback route, account-link flow, and a
  security review of the session/linking logic before merge.

---

### Phase 7 — Email ⚠️ ADR (D-EMAIL-SEND / D-EMAIL-READ)

**EMAIL-1 — Send invoices by email** · M
- Extend the existing `nodemailer` + `sendInvitationEmail` path to email a finalized invoice
  (PDF attachment or link) to the partner. Pick a deliverability provider (D-EMAIL-SEND).

**EMAIL-2 — Ingest + browse sent/received email** · L
- Read invoice-relevant emails into the DB so they can be consumed and attached to records.
  Scope per D-EMAIL-READ (auto-match to partners, not a full mail client). Gmail API is the
  fast path; the Gmail MCP connector can prototype ingestion + matching.

---

### ~~Phase 8 — i18n~~ — removed from this phase
i18n is **out of scope for now** (per product decision). Stays deferred as N19 in
`REFACTOR_BACKLOG.md`; revisit only when a second market is targeted.

---

## 4. Cross-cutting

**VAT-1 — VAT paid vs received + tax view** · L · ⭐ *core value — see PRODUCT_CONTEXT §1*
- The headline differentiated value from the founder interview: per company, per month, show
  **VAT received** (on issued invoices) vs **VAT paid** (on received invoices), the **net VAT owed
  to НАП**, and the trend — so owners/accountants see and optimize the monthly tax.
- Depends on the numbers being trustworthy first: GEN-1 (base-currency aggregation) + DASH-1
  (aggregation rules) + OI-1 (accounted status). Build correctness, then the view.
- Verify by running: with mixed income + expense invoices in a month, the VAT-owed figure
  reconciles by hand; toggling accounted/paid updates it correctly.

**TRANS-1 — Notifications on new/changed documents** · M · ⭐ *core value (transparency)*
- Both directions: notify the **accountant** when the owner adds/changes an invoice (income) or a
  received/expense doc, and notify the **owner** of accountant actions. In-app first; email (Gmail,
  EMAIL-1) later. Builds on the existing activity log.

**TRANS-2 — Shared "what's left this month" status view** · M · ⭐ *core value (transparency)*
- One view both owner and accountant see: for the current month, **done vs pending** — invoices
  still needing review/accounting, missing docs, VAT-ready status. Kills the "do you have everything
  for НАП this month?" back-and-forth. Depends on OI-1 (accounted status) + OI-5 (month filter).

**DASH-1 — Audit all money-aggregation rules** · M · *research/audit, pairs with GEN-1*
- Before GEN-1 lands, map every place that sums money (dashboard metrics, list totals,
  reports) and document the current rules — a `Discover`-gear task (subagents or a Workflow
  scanning `getDashboardMetrics` + all `totals` consumers). Output feeds the GEN-1 ADR.

**NAP-1 — NAP (НАП) compliance requirements** · L · ⚠️ *compliance — high priority*
- The attached `NAP.pdf` specifies requirements the app must meet. **Blocked on getting the PDF
  content** — it's a scanned/image document and the current machine has no OCR/render tooling, so
  it couldn't be extracted here. Owner to provide the text (or readable pages) → capture into
  `docs/knowledge/nap-compliance.md` → gap-analyze vs. the current invoice model → split into
  concrete items.
- **Baseline** (standard BG ЗДДС чл.114 invoice rules — a starting checklist, **verify against
  the actual PDF, do not assume it's the whole story**): sequential 10-digit numbering;
  mandatory supplier + recipient identity, address, EIK/VAT; description, quantity, unit price;
  taxable base + VAT rate + VAT amount + total; issue date + tax-event/supply date; legal grounds
  when VAT is 0%/exempt; original/copy marking. The PDF may add SAF-T, mandatory e-invoicing, or a
  specific NAP-notice format — **read it before scoping.**

**FUNC-AUDIT — Functional audit of existing flows** · M · *Discover gear, do early*
- Complements DASH-1's money focus: exercise the real flows **end-to-end by running the app**
  and catalog correctness gaps, not cosmetics. Cover: `createInvoiceDraft → finalize →
  credit-note`, received-invoice review → confirm → partner-link, payments, copy/cancel, and
  mixed-currency documents. For each, note broken/missing behavior, silent failures,
  unhandled edge cases, and data-integrity risks. Feed findings back as new roadmap items
  and into `docs/knowledge/`. This is where "features & functionality, not just UX" gets
  enforced against the existing product.

**RESEARCH-1 — Competitor feature + functionality research** · M · *Discover gear*
- Study **how established products actually work**, not just how they look. For each product,
  capture: invoice **numbering** rules, **status & lifecycle** (draft→issued→paid→cancelled,
  credit/debit notes), **currency & FX** handling, **VAT/tax** treatment, **payment tracking**
  and partial payments, **reminders/dunning**, **recurring** invoices, **exports** (PDF / CSV /
  accounting-software), **bulk actions**, **filtering** (esp. by month / accounting period),
  **permissions & roles**, **audit trail**, and **integrations**. Note the data model each
  implies. UX (lists, statuses, scan viewer) is one dimension among these.
- Set: **inv.bg**, fakturi.bg, Microinvest; internationally Stripe Invoicing, Xero,
  QuickBooks, FreshBooks, Zoho Invoice, and **Invoice Ninja** (open-source — read its actual
  schema + feature model). Output: `docs/knowledge/competitor-invoicing.md`, organized **by
  capability** (not by product), to inform OI-*, GEN-1, RV-1, and to surface features we're
  missing entirely.

**MEMBERS** — you left this section blank in the request. Add items here when you have them.

---

## 5. Suggested first moves for the Fable session

1. Run **RESEARCH-1** (parallel subagents, one per site) → `docs/knowledge/competitor-invoicing.md`.
   Capture features + functionality + data model, not just UX; surface gaps we're missing.
2. Run **FUNC-AUDIT** — drive the existing flows in a live preview and catalog correctness /
   edge-case / data-integrity gaps. Turn findings into new roadmap items.
3. Knock out **Phase 1** quick wins (OI-2, NI-2, RV-2, NI-1, OI-8) — fast, no decisions —
   verifying each in a running preview before committing.
4. Write the **GEN-1/D-FX ADR** and **DASH-1 audit** in parallel — money correctness is the
   highest-stakes item; get the design right early.
5. Get **D-CANCEL** answered by Koceto and saved to memory so OI-3 can unblock.

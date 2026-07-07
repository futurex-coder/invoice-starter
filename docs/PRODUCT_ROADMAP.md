# Product Roadmap & Feature Backlog

> **For the Fable 5 (and future) sessions.** This is the master plan for the next
> phase: fixing/improving existing flows and building new features. It's a living
> document — update item status in the same commit as the work, exactly like
> `docs/REFACTOR_BACKLOG.md`.

**Created:** 2026-07-07
**Base branch:** `main` (after `claude-run-1.8` merges). Start feature work on fresh
branches off `main`.

**Working discipline:** identical to `REFACTOR_BACKLOG.md` §10 — load the matching
skill first, break each item into `TaskCreate` steps, verify **type-check + lint +
`npm test` (baseline 201) + `npm run build`** before every commit, keep commits atomic,
tick the item here when done. Strict TS rules from `.claude/CLAUDE.md` apply (no `any`,
no `as` casts, no `@ts-ignore`).

**Scope note — "not only Bulgaria":** decided **i18n UI strings only**. Keep the BG
tax / VAT / invoice-numbering logic as-is. Do *not* generalize jurisdiction rules in
this phase; just make new UI text translatable. (See I18N-1.)

---

## 1. How to run this phase — the four gears

| Gear | Claude features | Use for |
|---|---|---|
| **Discover** | `WebSearch`/`WebFetch`, parallel subagents (1 per competitor site), optional multi-agent **Workflow** | competitor UX research (RESEARCH-1); auditing money-aggregation rules (DASH-1) |
| **Decide** | `engineering:architecture` (ADRs), `AskUserQuestion`, **memory** (persist answers) | GEN-1 currency, AUTH-1, EMAIL-1/2 |
| **Build** | **plan mode** per feature, skills (`senior-frontend`/`-backend`/`-data-engineer`/`-security`), subagents for mechanical fan-out | every item |
| **Ship** | `/security-review` (auth + email), `engineering:deploy-checklist`, Supabase MCP (migrations), Vercel MCP (deploy) | before each PR |

**Available MCP connectors in-env:** Supabase (schema/migrations), **Gmail** (fast path
for EMAIL-2 ingestion), Vercel (deploy).

**Parallelizable tracks** (independent — safe to run in separate sessions/branches):
Phase 1 quick wins · MENU-1 · RV-1 viewer. Sequence the rest per the dependency notes.

---

## 2. Decisions register — lock these before building the dependent item

| ID | Decision | Status | Recommendation |
|---|---|---|---|
| **D-CANCEL** | How should invoice Cancel behave? (OI-3) | ❓ OPEN — **ask Koceto** | Today: mark `cancelled`, immutable, reverse via credit note. Confirm what's actually wrong; save his answer to memory. |
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

### Phase 5 — Received-invoice scan viewer

**RV-1 — Better scanned-invoice viewer** · M/L · *frontend*
- Desktop: use more screen width; show **one page at a time** with **pagination + zoom**.
- Mobile: a **bottom drawer** that shrinks/expands.
- Consider a PDF/image renderer that supports page navigation + zoom; keep it self-contained.
- Accept: a multi-page scan is readable on desktop and phone without the current cramped view.

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

### Phase 8 — i18n (UI strings only)

**I18N-1 — Translatable UI strings** · M
- This is `REFACTOR_BACKLOG.md` N19, now scoped: extract UI strings into a message
  catalog (BG + EN), add a locale switch. **Do not** touch tax/VAT/numbering logic.
- Do this once several features have settled so you're not re-extracting churned strings.

---

## 4. Cross-cutting

**DASH-1 — Audit all money-aggregation rules** · M · *research/audit, pairs with GEN-1*
- Before GEN-1 lands, map every place that sums money (dashboard metrics, list totals,
  reports) and document the current rules — a `Discover`-gear task (subagents or a Workflow
  scanning `getDashboardMetrics` + all `totals` consumers). Output feeds the GEN-1 ADR.

**RESEARCH-1 — Competitor UX research** · M · *Discover gear*
- Study how established products handle invoice lists, statuses, currency, and scan viewers.
- Set: **inv.bg**, fakturi.bg, Microinvest; internationally Stripe Invoicing, Xero,
  QuickBooks, FreshBooks, Zoho Invoice, and **Invoice Ninja** (open-source — inspect its
  actual feature model). Output: `docs/research/competitor-invoicing.md` to inform OI-*, RV-1.

**MEMBERS** — you left this section blank in the request. Add items here when you have them.

---

## 5. Suggested first moves for the Fable session

1. Run **RESEARCH-1** (parallel subagents, one per site) → `docs/research/competitor-invoicing.md`.
   It de-risks the OI-* and RV-1 UX before any code.
2. Knock out **Phase 1** quick wins (OI-2, NI-2, RV-2, NI-1, OI-8) — fast, satisfying, no decisions.
3. Write the **GEN-1/D-FX ADR** and **DASH-1 audit** in parallel — money correctness is the
   highest-stakes item; get the design right early.
4. Get **D-CANCEL** answered by Koceto and saved to memory so OI-3 can unblock.

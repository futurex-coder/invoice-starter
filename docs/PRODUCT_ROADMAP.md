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
(type-check + lint + `npm test` baseline 214 + `npm run build`) passes, keep commits
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

**OI-2 — Fix Copy invoice** · S · *bug* · ✅ **done 2026-07-08**
- `onCopy` now routes to `/c/[id]/invoices/new?copy=<sourceId>`; the page hydrates via
  `invoiceToCopyFormState` (clones partner/lines/currency/fxRate/payment method/VAT
  mode/language; resets dates to today, unpaid, no notes; always docType `invoice` —
  a copied note would need its own reference; number allocated on first save).
- Verified: 4 unit tests on the copy hydration + an end-to-end action replay of the
  exact form payload (copy of invoice 11 → draft id 56, **number 4**, draft, 1920 BGN,
  partner cloned). Preview harness was wedged (see PREVIEW-ENV) so the DOM click itself
  is pending a working embedded browser; the wiring mirrors the proven `?edit=` path.

**NI-2 — Remove customer-visible note** · S · ✅ **done 2026-07-08**
- Field removed from `NotesCard`; `customerNote` stays in schema + save payload so
  re-saving an old draft doesn't wipe its historical note. Verified live: only the
  internal-comment textarea renders on /invoices/new.

**RV-2 — Remove due date from received-invoice review** · S · ✅ **done 2026-07-08**
- Field removed from ReviewForm (date grid → 2 cols); `due_date` removed from the extraction
  Zod schema + prompt (schema/output/rules sections) and from the create-draft mapping.
  Old stored extractions still parse (Zod strips unknown keys); the `dueDate` column stays —
  form state keeps carrying it so re-saving an old row preserves the stored value; payments
  overdue logic unaffected for historical rows.

**NI-1 — Preview + Finalize without saving a draft first** · M · ✅ **done 2026-07-08**
- Finalize from an unsaved form = **one server transaction** (`createInvoiceDraft` with
  `finalizeImmediately: true` — validates against the finalized rules, allocates the number,
  inserts already-finalized, logs CREATE + FINALIZE atomically; note doc-types refused).
  Preview from an unsaved form **implicitly saves the draft** then opens the print view
  (logged to REVIEW_QUEUE as the reversible default — a pure client-side render can come
  with RV-3/print work). Bonus fix: Finalize on an *edited saved draft* now saves the latest
  form state first (it used to finalize the stale stored version).
- Verified live: new form → Finalize → Фактура № 0000000005 finalized in one action
  (server log shows a single createInvoiceDraft call; 360 EUR reconciled by hand); +2
  integration tests (16 total in the lifecycle suite).

**OI-8 — Clear navigation links on the invoice list** · S · ✅ **done 2026-07-08**
- Invoice number → invoice detail; partner name → partners list pre-filtered via the
  URL-synced `?search=` (no partner-detail route exists yet); CN/DN "→ parent" link kept.
- Verified live: links render on all 7 rows, number-link click-through loads the detail
  page, no console errors.

---

### Phase 2 — Invoice-list UX (needs the accounted-status column first)

**OI-1 — "Accounted" status on outgoing invoices** · M · *schema* · ✅ **done 2026-07-08**
- `invoices.accounting_status varchar(20) NOT NULL DEFAULT 'pending'` + composite index
  `(company_id, accounting_status)` — migration `0003_lonely_argent`, applied to dev.
  Parser layer: `AccountingStatus` type + `parseAccountingStatus` wired into
  `parseInvoiceRow`/`ParsedInvoice`. List shows an Accounting pill column (Pending gray /
  Accounted sky). Verified live: column + pills render on all rows.
- Unblocks: OI-4, OI-6/OI-9, TRANS-2, VAT-1.

**OI-4 — Filter by accounted status** · S · ✅ **done 2026-07-08**
- `accountingStatus` filter (All/Pending/Accounted) in the invoice list — URL-synced.
  Verified live: `?accountingStatus=accounted` → exactly the one accounted document.

**OI-5 — Month-only filter (drop from/to)** · M · ✅ **done 2026-07-08**
- From/to range replaced by a single `<input type="month">`; server query bounds
  `date_trunc('month', issue_date)`; `month` stays in `ListInvoicesFilters` alongside the
  (still-supported) dateFrom/dateTo for API callers. Verified live: `?month=2026-07` →
  exactly the 3 July documents, picker hydrates from the URL.

**OI-6 — Row context-menu status setters** · M · *depends on OI-1*
- Extend `RowActionsMenu` on each invoice row with quick setters: mark paid/unpaid,
  mark accounted/pending. Each dispatches the matching action + optimistic
  `mutate(...,{revalidate:false})` (pattern from N11). Reuse `updateInvoicePaymentInfo`
  for payment; add an `updateInvoiceAccountingStatus` action.

**OI-7 — Expandable row detail** · M · ✅ **done 2026-07-08 (outgoing list)**
- Chevron on each outgoing row expands a read-only line-item mini-table (Description ·
  Qty · Unit · Unit price · Disc.% · Total + Net/VAT/Total footer) rendered from the
  row's **already-loaded items snapshot** — zero extra queries; one row expanded at a
  time; scrolls horizontally on mobile.
- Verified live: invoice #1 expands to its line (20 × 80) with Net 1 600 · VAT 320 ·
  Total 1 920 — reconciled; collapse restores the plain list. Received-side expansion
  deferred (list items don't carry lines; the review/detail pages serve that need).

**OI-9 — Simplify both lists + inline paid/accounted editing** · M · ✅ **done 2026-07-08**
- Both lists now: **Number · Client/Supplier · Date · Total · Paid · Accounted · Status ·
  Actions** (lifecycle Status kept — it's legal state, not noise; outgoing Type column
  replaced by a КИ/ДИ badge next to the number; Payment text folded into the Paid pill).
- Shared `PaidTogglePill` / `AccountedTogglePill` (components/list-page/StatusTogglePill):
  click flips paid⇄unpaid / accounted⇄pending with the list-mutation pattern; disabled
  (dash) on drafts/cancelled/discarded; partial renders amber and clicking marks paid.
  New `updateInvoiceAccountingStatus` action (finalized-only rule); received side reuses
  its existing setters. Row-menu setters remain as secondary affordance (OI-6 superseded).
- Verified live: outgoing #5 pending→accounted persisted and the TRANS-2 month card
  dropped 2→1 издадени за осчетоводяване; Paid round-trip unpaid→paid→unpaid; received
  RI 8 accounted toggle round-trip. Zero console errors.

**OI-10 — Edit invoices regardless of status** · M · ✅ **received side done 2026-07-08** · ⚠️ *outgoing blocked on D-EDIT*
- **Received side complete:** confirmed docs were already freely editable (row-menu Edit →
  review screen; re-confirm = update, `confirmedAt` preserved — verified in FUNC-AUDIT).
  The missing piece was discarded docs being a dead end — new
  `restoreDiscardedReceivedInvoice` action + "Restore to draft" row action. Verified live:
  discarded 417 → draft → re-discarded (DB round-trip confirmed).
- **Outgoing finalized/cancelled:** untouched until D-EDIT — a finalized фактура is a
  sequential legal document (see decisions register; Invoice Ninja's `lock_invoices`
  setting is the researched compromise pattern).

**OI-11 — "All invoices" view** · S/M · ✅ **done 2026-07-08**
- New **All** tab (`/c/[id]/invoices/all`): UNION of outgoing documents (all statuses —
  they're your own working set) + confirmed non-archived received docs, ordered by issue
  date, with Издадена/Получена direction badges, month + search filters (URL-synced),
  pagination, and per-row links to the right detail page.
- Verified live: 8 interleaved documents; `month=2026-05` narrows to exactly the one May
  received invoice.

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

**MENU-1 — Desktop horizontal header nav + consolidations** · M · ✅ **done 2026-07-08**
- Desktop nav is a horizontal bar (CompanySwitcher + Dashboard · Invoices · ДДС/VAT ·
  Partners · Articles · Company · Activity, Account right-aligned); mobile keeps the
  drawer with the same consolidated items. **Received invoices** left the menu (reachable
  via the Invoices All/Outgoing/Received tabs; prefix-matching keeps Invoices highlighted
  there). **Company + Members** merged as tabs via a `settings/layout.tsx`. **General +
  Security** merged under one **Account** entry with tabs. *Deliberate deviation:* company
  Activity was NOT merged with the user-scoped General/Security (different scopes — company
  audit vs personal account); it stays a top-level company item — noted for the owner.
- Verified live: nav renders (no Received), settings tabs click through to Members,
  Account tabs render, mobile drawer intact with no body overflow.

---

### Phase 5 — Received-invoice review redesign

**RV-3 — Redesign the whole review-received-invoice screen** · L · 🟡 **queued (deliberately not
started at the end of the 2026-07-08 overnight run — an L rebuild of the app's core
differentiator shouldn't land half-done)**
- Already absorbed: RV-2 ✅ (due date gone), RV-4 ✅ (name-only partners + real-document
  line tolerance), RV-1 first slice ✅ (image zoom + mobile collapse).
- Remaining rebuild: field grouping (Supplier / Document / Items as distinct cards with
  clearer hierarchy), inline validation that **guides rather than blocks** (soft warnings
  vs the red rings; the schema is already tolerant post-RV-4), wider desktop layout
  (viewer deserves >50%), true mobile bottom drawer for the scan, and the review→confirm
  flow driven end-to-end with a multi-page + foreign-supplier scan.
- Implementation notes for the next session: the form is already `useReducer`-based
  (`review-form-state.ts`) with `FieldMetaMap` confidence hints — build ON that, don't
  replace it; `ReviewForm.tsx` is 900+ lines — extract the Supplier/Document/Items cards
  as separate components as part of the regroup; the numbering/tax constraints live in
  `knowledge/invoice-numbering-triggers.md`.

**RV-1 — Better scanned-invoice viewer** · M/L · 🟡 **first slice shipped 2026-07-08**
- Shipped: **image zoom** (50–400% with ± / reset — scanned images previously had no zoom
  at all; PDFs already page/zoom natively in the embed) and a **mobile collapse toggle**
  on the pane so the form gets the screen (approximation of the bottom-drawer idea).
- Remaining for the full RV-3 treatment: true bottom drawer on mobile, wider desktop
  layout, page-at-a-time for images (multi-page TIFF/scan sets), pinch zoom.

**RV-4 — "Save as partner" needs only a name** · S · ✅ **done 2026-07-08**
- Shipped: `partners.eik` is now **nullable** with a partial unique index (unique per company
  only when an EIK exists) — migration `0002_dusty_sumo`, applied + verified on dev.
  `createPartnerSchema` requires only the name (EIK/VAT normalized ''→null, BG format enforced
  only when a value is present; city/street optional). The confirm path creates partners
  without EIK and dedupes by exact name when no EIK (by EIK otherwise); the `'-'` address
  placeholders are gone. PartnerForm required-marks relaxed accordingly.
- The acceptance run also surfaced + fixed two more real-document blockers: received-invoice
  line schema now allows an **empty unit** (US invoices print none) and **negative unit
  prices** (Cursor's $-20 discount line).
- **Verified on the real data:** confirmed the actual Cursor (US) invoice (RI 13, company 9)
  with save-as-partner — partner «Cursor» created with name + NY address, `eik: null`, linked,
  zero validation errors.

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

**VAT-1 — VAT paid vs received + tax view** · L · ⭐ *core value* · ✅ **v1 done 2026-07-08**
- New **ДДС / VAT** page (`/c/[id]/vat`, in the sidebar): last 12 months × currency —
  ДДС продажби (accrual: all finalized docs, CN subtract — `issuedVatSumSql` in money.ts),
  ДДС покупки (confirmed received docs), **Нето за НАП** (red = owed, green = refundable),
  current month highlighted; mixed-currency banner until GEN-1 lands FX.
- **Verified by hand against the raw DB**: all 8 live rows reconcile exactly (incl. CN
  issued-in-February subtraction 100−80=+20, draft exclusion, per-currency split, received
  side −1160 EUR refundable). Zero console errors; mobile: table scrolls, no body overflow.
- Follow-ups when unblocked: FX-converted single-currency view (GEN-1/D-FX); month detail
  drill-down (дневник-style doc list per month) — natural next slice with OI-5.

**TRANS-1 — Notifications on new/changed documents** · M · ⭐ *core value* · ✅ **v1 done 2026-07-08**
- In-app **notification bell** in the header: everything OTHER members did in your
  companies (accountant sees owner actions and vice versa — both directions fall out of
  the membership join). Unread = after your per-company `notifications_seen_at` high-water
  mark (migration `0004`; join date bounds history for new members). Opening the bell
  marks all seen (optimistic + persisted). 60s SWR polling; items deep-link to the
  company's activity page.
- Verified live: alice's bell showed 5 unread of Bob's Бета actions with labels + relative
  times; mark-seen survives a full reload. Email channel stays with EMAIL-1/D-EMAIL.

**TRANS-2 — Shared "what's left this month" status view** · M · ⭐ *core value* · ✅ **v1 done 2026-07-08**
- `MonthCloseCard` on the company dashboard (same card for owner + accountant): month
  checklist — received invoices awaiting review (any month; they block the close),
  outgoing + received documents issued this month not yet accounted (OI-1 status), net
  VAT for the month per currency with a link to /vat, and a Готово-за-НАП / Има-недовършено
  chip. Server-side `getMonthCloseStatus` in the dashboard query layer.
- Verified live: юли 2026 → 0 review / 2 издадени за осчетоводяване / 0 получени,
  ДДС −100.00 BGN · 60.00 EUR — every value reconciled by hand. "Missing docs"
  expectations (what *should* exist but doesn't) deliberately out of v1 scope.

**DASH-1 — Audit all money-aggregation rules** · M · ✅ **done 2026-07-08**
- Shipped `docs/knowledge/money-aggregation-rules.md` — the canonical rules (code:
  `lib/db/queries/money.ts`), the complete map of money-summing sites, the known gaps
  (currency-blind sums → GEN-1; CN-vs-cancelled-parent → D-CANCEL; overdue count-vs-amount;
  cash-vs-accrual "revenue" for VAT-1), and the invoice-11 incident note. Feeds the GEN-1 ADR.

**AGG-1 — Fix the decision-free aggregation holes** · M · *bug, from FUNC-AUDIT* · ✅ **done 2026-07-08**
- Shipped `lib/db/queries/money.ts` — canonical signed-sum fragments (CN subtracts, DN
  adds; `partial` counts as outstanding; note paymentStatus = "is the refund settled") —
  wired into both `getCompanyMetrics` and `getDashboardMetrics`. Real-DB integration
  suite pins an 8-document ledger (collected 800 / outstanding 800 / overdue 2); live
  data reconciles by hand (Алфа: 1440 / 360, was 1920 / 600). FX conversion explicitly
  deferred to GEN-1 — it will land inside money.ts so every consumer inherits it.

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

**FUNC-AUDIT — Functional audit of existing flows** · M · *Discover gear* · ✅ **done 2026-07-08**
- Shipped: `docs/knowledge/func-audit-2026-07.md` — flow-by-flow verdicts against the real
  dev DB. Two production bugs found in the CN/DN path (numbering-trigger violation → fixed
  in N15; note inheriting the parent's supplyDate → every note vs an invoice >5 days old
  failed → fixed in `acdaad6`, verified UI→DB). Money-aggregation holes quantified with
  hand reconciliation → **AGG-1** (decision-free fixes) + DASH-1 head start; payment model
  confirmed enum-only → **PAY-1** candidate. Permission boundary + cross-company scoping
  verified enforced server-side.

**RESEARCH-1 — Competitor feature + functionality research** · M · *Discover gear* · ✅ **done 2026-07-07**
- Shipped: `docs/knowledge/competitor-invoicing.md` — all 9 products (incl. inv.bg's public
  APIv3 data model and Invoice Ninja's actual MySQL schema), organized by capability, with
  data-model lessons (§15) and a gap list (§16) that seeded the RESEARCH-1 candidates section
  below. Key decision inputs: inv.bg cancel is *reversible*; Invoice Ninja's `lock_invoices`
  setting is the D-EDIT compromise pattern; ECB-daily + freeze-at-finalize confirmed as the
  D-FX norm; «осчетоводена» list state in inv.bg validates OI-1/OI-9.

**RESEARCH-1 candidates — features we're missing entirely** *(backlog, unscheduled; from
`knowledge/competitor-invoicing.md` §16)*
- **PROF-1 — Proforma invoices** · M — first-class doc type in all 3 BG competitors; BG table
  stakes. Numbering + convert-to-invoice flow.
- **REC-1 — Recurring invoice templates** · M/L — templates + schedule + draft-or-issue +
  auto-email + period placeholders (both BG leaders have this).
- **SER-1 — Multiple numbering series (кочани)** · M — all 3 BG products; wait for user demand.
- **EUR-1 — Dual EUR/BGN display** (1.95583) on printed documents · S/M — both BG leaders
  shipped this for the 2026 euro adoption; verify what we print today.
- **VAT-2 — Reusable 0%/exempt legal-grounds list** in settings · S — pairs with VAT-1.
- **HIST-1 — Per-document history view with old→new diffs** · M — Xero/QBO/Zoho pattern;
  pairs with TRANS-1 and the transparency story.
- **REM-1 — Overdue payment reminders** · M — after TRANS-1.
- **LINK-1 — Client-facing document links + viewed/accept/reject tracking** · L — inv.bg
  confirmation flow / Invoice Ninja invitations; pairs with EMAIL-1.
- **BANK-1 — Bank statement import + payment auto-match** · L — future endgame (inv.bg).
- **ESIGN-1 — E-signature (B-Trust/InfoNotary/StampIt)** · L — future.
- **PAY-1 — Real payment ledger** · L — amount/date/method per payment, M:N allocation to
  invoices (inv.bg / Invoice Ninja model, `competitor-invoicing.md` §5). Today payment
  tracking is a status enum only — `partial` has no amount behind it (FUNC-AUDIT).

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

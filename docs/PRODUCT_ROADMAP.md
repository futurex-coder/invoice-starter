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

**⭐ Current direction (set 2026-07-08, owner) — POLISH THE CORE, DEFER EMAIL + AUTH.**
The goal for run 2 onward is to make what we already have **complete, correct, and easy to
use** — not to add big new surfaces. Concretely:
- **Deferred to "later" (do NOT build now):** Phase 6 **AUTH-1** (Google login), Phase 7
  **EMAIL-1/EMAIL-2** (send + ingest email), and **BULK-1** (depends on both). Leave the
  decisions register rows open; skip these items entirely this phase.
- **Top priority: ASYNC-SCAN** (below) — make the expense scanner non-blocking: upload →
  rows appear instantly → parallel background analysis → auto-saved as draft → click to
  review, open the original file anytime. This is the flagship "easy to use" change.
- After ASYNC-SCAN: **RV-3** review redesign, then the remaining polish items. Every flow
  should be finished to the "verified by running, happy + edge paths" bar in §C of the
  kickoff — no half-built features.

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

| ID | Decision | Status | Resolution / Recommendation |
|---|---|---|---|
| **D-CANCEL** | How should invoice Cancel behave? (OI-3) | ✅ **RESOLVED 2026-07-08** | Cancel is **reversible** (add Uncancel). **`accounted` is the lock** — see EDIT-RULE. Delete allowed while not accounted. |
| **D-EDIT** | Can finalized outgoing invoices be edited? (OI-10) | ✅ **RESOLVED 2026-07-08** | Editability gated on **`accounted`**, not draft/finalized: anything not `accounted` is fully editable + deletable; `accounted` locks it (toggle un-account to edit again). → **EDIT-RULE**. Compliance caveat: keep an audit trail of edits to finalized docs. |
| **D-FX** | FX rate source for currency conversion (GEN-1) | ✅ **RESOLVED 2026-07-08 — approved** | ECB daily reference rates; cache daily; **freeze the rate onto each document at finalize**. `invoices.fxRate` + `receivedInvoices.fxRate` exist. **GEN-1 unblocked.** |
| **D-NUM** | Numbering for notes / all doc types (CN-NUMBERING) | ✅ **RESOLVED 2026-07-08 — REVERSED** | EVERY document (invoice/CN/DN/proforma) gets its **own unique new number**, no duplicates. Reverses run-1's inherit-parent-number. → **NUM-1** (DB-trigger rewrite; closes N24). |
| **D-AUTH** | Google login approach (AUTH-1) | ⏸️ **DEFERRED 2026-07-08** | Use **Supabase Auth** Google login when revisited. Not this phase. |
| **D-EMAIL-SEND / READ** | Email transport + ingestion (EMAIL-1/2) | ⏸️ **DEFERRED 2026-07-08** | Leave email for later entirely. |

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

### Phase 1.5 — ⭐ TOP PRIORITY — Async expense scanner (non-blocking upload → analyze → draft)

**ASYNC-SCAN — Non-blocking parallel expense scanner** · L · ⭐ *flagship "easy to use"* · ✅ **done 2026-07-08**
- **Shipped:** upload is now store-only (inserts an `analyzing` row + returns immediately —
  no AI call in the request); a new `POST /api/received-invoices/[id]/analyze` runs the
  extraction and flips the row to `draft` (or `failed`+error, retryable); the uploader uploads
  in parallel and redirects to the list; the list **drives analysis** for any `analyzing` row
  (capped at 5 concurrent) and SWR-polls until none remain; the table shows `analyzing`
  (spinner) / `failed` (Retry) / `draft` states, with the file-open link working from upload.
  Migration `0005_free_ares` (status `analyzing`/`failed`, nullable `rawExtraction`/`extractedAt`,
  `analysis_started_at`/`analysis_error`). Default list view changed to the working set
  (analyzing/failed/draft/confirmed; only discarded hidden) so in-progress rows are always
  visible + driven.
- **Verified end-to-end against the real DB + AI + storage:** a real uploaded PDF
  ("таблет фактура.pdf", company 81) went upload→`analyzing`→driver auto-fired→extraction
  (`claude-sonnet-4-6`)→`draft` with invoice №0814051604, supplier ЗОРА ММС ООД, net 1103.88 +
  VAT 220.78 = gross 1324.66 EUR (reconciled by hand), 1 line, confidence high. Failure path
  verified (missing model → `failed` + stored error → Retry). Duplicate detection still fires
  on the analyzed draft. Verify quad green (type-check, lint 0, tests 222, build).
- **Fix found while verifying (N27):** the extraction model constant was
  `claude-sonnet-4-20250514`, now **retired → 404 not_found** on the live API key — every
  extraction was failing. Updated `EXTRACTION_MODEL_ID` to `claude-sonnet-4-6` (probed the key:
  4-5 / 4-6 / sonnet-5 / haiku-4-5 all 200; only the dated snapshot 404s). This affected the
  OLD synchronous flow too — extraction was broken before this change.
- **Problem (before — synchronous & blocking):** `app/api/received-invoices/upload/route.ts`
  stores the file **and** runs the two-pass Claude extraction *inline* before the row exists,
  and `ReceivedInvoiceUploader.tsx` processes dropped files **serially**. So the user waits
  through up to two AI calls **per file, one file at a time**, staring at "Analyzing" before
  anything appears. That's the exact blocking we're removing.
- **Target UX (owner's words):** "when I upload files I want to see them in the table right
  after they're uploaded; then the scanner runs them **in parallel** so the user isn't
  blocked; when a row is analyzed I can click it to review, and I can open the uploaded file;
  everything the analyzer produces is saved directly but **as a draft until reviewed**."
- **Design — split "store the file" from "analyze the file":**
  1. **Data model** — extend `received_invoices.status` with two pre-draft states:
     `'analyzing'` (file stored, AI running) and `'failed'` (extraction errored, retryable).
     New order: `analyzing → (failed) → draft → confirmed → discarded`. Make `rawExtraction`
     **nullable** (row now exists before the AI runs) and `extractedAt` nullable; add
     `analysisStartedAt timestamp` + `analysisError text`. Add `'analyzing'`/`'failed'` to
     `RECEIVED_INVOICE_STATUSES` in `src/features/received-invoices/types.ts`. **One migration**
     (`db:generate` → review SQL → apply). NOTE: `rawExtraction` default `.default('draft')`
     status must change to `.default('analyzing')`.
  2. **Upload route → store-only.** Validate + upload to Supabase + insert a shell row with
     `status:'analyzing'`, `rawExtraction:null`, `analysisStartedAt:now()`, and the file
     columns; return `{id, originalName}` immediately. No AI call in this request. Refactor the
     extraction-application half of `createDraftFromUpload` (actions.ts:177-298 — totals,
     partner match, line insert, dedup) into a reusable `applyExtractionToRow(id, extraction)`
     used by the analyze route; keep a shell-insert `createAnalyzingRow(...)`.
  3. **New analyze route** `POST /api/received-invoices/[id]/analyze` (withApiCompanyAuth) —
     loads the row, reads the stored bytes back from the bucket, runs `extractInvoiceFromBytes`,
     calls `applyExtractionToRow` (writes extracted values + lines, sets `rawExtraction`,
     `extractedAt`, `extractionConfidence/ModelId`), flips `status → 'draft'`. On error: set
     `status:'failed'` + `analysisError`, keep the file (retryable). Idempotent/guarded so a
     double-fire can't double-insert lines (re-analysis should replace lines like
     `applyReviewPatch` does).
  4. **Uploader** — upload all dropped files **in parallel** (store-only calls; keep the
     client-side WebP compression), collect the returned ids, then fire the analyze requests
     **in parallel with a concurrency cap (~5)** so a big drop doesn't hammer the API; then
     **redirect to the received-invoices table** (not the two-step review page). The user sees
     rows immediately.
  5. **Table** (`_components/ReceivedInvoicesTable.tsx`) — render the new states: `analyzing`
     = spinner + "Analyzing…" (row NOT yet review-clickable, but the **file-open link works
     from the instant of upload**); `failed` = red state + **Retry** button (re-POSTs analyze);
     `draft`/`confirmed`/`discarded` as today. **SWR-poll the list while any row is
     `analyzing`** (short interval, stop when none remain) so rows self-update to `draft`
     without a manual refresh. `listReceivedInvoices` + `ReceivedInvoiceListItem` must carry the
     new `status` values (already `ReceivedInvoiceLifecycleStatus`); `pendingCount` still counts
     `draft` only.
  6. **Review + open-file** already exist (`review/[id]`, `PreviewPane`, file redirect route) —
     they just work once a row reaches `draft`. Auto-save-as-draft is inherent: analysis writes
     draft values, so nothing is ever lost even if the user never opens the review screen.
- **Platform note (deliberate):** parallelism is **client-orchestrated** (fire N analyze
  requests after upload), NOT a server background worker — this app is Vercel serverless where
  post-response background work isn't guaranteed to finish. The `failed`/Retry state + a
  "re-analyze stuck rows" affordance cover a tab closed mid-batch. Log this in REVIEW_QUEUE if
  you deviate.
- **Verify by running (per §C):** drop **multiple** files at once → all rows appear as
  `analyzing` within ~1s → they flip to `draft` independently as each analysis finishes (prove
  parallelism: total wall-clock ≈ slowest single file, not the sum) → open the original file
  on an `analyzing` row (must work) → force a failure (bad/blank image) → row shows `failed` +
  Retry → click a `draft` row → review → confirm. Reconcile one extracted total by hand.
  Mobile + desktop; zero console errors; no failed network requests (other than the induced one).
- **Edge cases:** 0 files; 10+ files at once (cap holds, no rate-limit storms); duplicate file
  (checksum dedup still surfaces in review); non-invoice image (low confidence → still a draft,
  flagged); very large PDF; user navigates away mid-batch (rows stay `analyzing`, Retry recovers).

---

### Phase 1.6 — Editability, numbering & new-invoice rules (from 2026-07-08 owner answers)

**EDIT-RULE — `accounted` is the single edit/delete lock** · M · *unblocks OI-3, OI-10 outgoing*
- Rule (D-CANCEL + D-EDIT): an invoice is **freely editable and deletable while its
  `accountingStatus` ≠ `accounted`**; once `accounted` it locks (edits + delete blocked). The
  Accounted toggle is always available, so un-accounting re-opens editing. **Cancel is
  reversible** — add an **Uncancel** action alongside Cancel.
- Work: gate the outgoing edit path on `accountingStatus !== 'accounted'` (not on
  draft/finalized); add Uncancel action + row menu; add **Delete** (hard or soft — pick soft/
  archive if it protects numbering continuity) for non-accounted invoices; enforce the lock
  server-side in the actions, not just the UI. Keep an **activity/audit entry** for edits to
  finalized documents (compliance caveat — see REVIEW_QUEUE D-EDIT).
- Edge cases: editing a finalized doc that has credit notes against it; deleting a doc that
  leaves a numbering gap (decide: reuse vs. gap — pairs with NUM-1); cancel→uncancel→edit chain.

**NUM-1 — Unique number per document, all types** · L · *schema/trigger* · *reverses run-1 CN-numbering*
- Rule (D-NUM): every document — invoice, credit note, debit note, proforma — gets its **own
  new unique number**; **no duplicate numbers ever**. The note→parent relationship stays via
  `referencedInvoiceId`; only the number changes.
- ⚠️ This is a **DB-trigger change** and closes **N24**: the live
  `trg_enforce_invoice_numbering` currently forces notes to inherit the parent's series+number
  and rejects proforma (full source in `knowledge/invoice-numbering-triggers.md`, NOT yet in
  repo migrations). Steps: (1) bring the trigger into a repo migration; (2) rewrite it to assign
  a fresh unique number per document and accept proforma; (3) update `createNoteFromInvoice`
  (stop inheriting the number) + the numbering integration tests together; (4) re-verify CN/DN
  creation UI→DB. Prerequisite for PROF-1 and the CN-FORM restriction.

**PROF-1 — Proforma as a real doc type** · M · *now in-scope (was backlog)* · *depends on NUM-1*
- Make `proforma` insertable (trigger accepts it after NUM-1), with its own numbering and a
  convert-to-invoice flow. Needed so the new-invoice form can offer it.

**NEWINV-1 — New-invoice form: Invoice + Proforma only, remove Preview** · S · *depends on PROF-1*
- DocumentCard offers **Invoice and Proforma only** (drop credit_note/debit_note — notes come
  from a finalized invoice's row menu). Remove the **Preview** button from the new-invoice
  ActionsBar — leave only **Save draft** and **Finalize** (per NI1-PREVIEW). Preview/print stays
  on the saved-invoice detail/row menu.

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

**BULK-1 — Row selection + bulk email via Google** · M · *depends on EMAIL-1 + AUTH-1* · ⏸️ **DEFERRED (2026-07-08 direction — email/auth on hold)**
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

### Phase 6 — Google auth ⚠️ ADR (D-AUTH) + `/security-review` · ⏸️ **DEFERRED (2026-07-08 direction — do NOT build this phase)**

**AUTH-1 — Google login + account linking** · L · ⏸️ **DEFERRED**
- Add Google OAuth sign-in and **linking to existing accounts** (match by verified email
  to the `users` table). Current sessions are hand-rolled (`jose` + bcrypt), so this is real
  work — the ADR decides library vs. hand-roll.
- Needs: Google Cloud OAuth credentials (env), callback route, account-link flow, and a
  security review of the session/linking logic before merge.

---

### Phase 7 — Email ⚠️ ADR (D-EMAIL-SEND / D-EMAIL-READ) · ⏸️ **DEFERRED (2026-07-08 direction — do NOT build this phase)**

**EMAIL-1 — Send invoices by email** · M · ⏸️ **DEFERRED**
- Extend the existing `nodemailer` + `sendInvitationEmail` path to email a finalized invoice
  (PDF attachment or link) to the partner. Pick a deliverability provider (D-EMAIL-SEND).

**EMAIL-2 — Ingest + browse sent/received email** · L · ⏸️ **DEFERRED**
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

## 5. Suggested first moves — run 2 (2026-07-08 direction)

Phases 0–7 of the original plan are shipped except the deferred/queued items. Run 2 focuses on
**polish, correctness, and ease of use** — build EMAIL/AUTH nothing.

1. **ASYNC-SCAN** (Phase 1.5) — the flagship change. Build it end-to-end in the order in its
   spec (migration → store-only upload → analyze route → uploader parallelism → table states +
   poll), verifying each slice by running the app. This is the top priority.
2. **Phase 1.6 (now unblocked by the 2026-07-08 answers):** **NUM-1** (unique number per doc —
   DB-trigger rewrite, closes N24) → **PROF-1** (proforma) → **NEWINV-1** (form = Invoice +
   Proforma, remove Preview) → **EDIT-RULE** (accounted-gates edit/delete + Uncancel). NUM-1 is
   the foundation for the others; sequence matters.
3. **RV-3** — the review-screen redesign (spec in Phase 5). Pairs with ASYNC-SCAN (same flow).
4. **GEN-1** currency conversion — **D-FX approved**, so this is unblocked; lands in `money.ts`.
5. Remaining **polish** across the app to the §C "verified by running, happy + edge paths" bar.
6. **Do NOT** start AUTH-1, EMAIL-1/2, or BULK-1 — deferred by owner direction.

### Historical — original run-1 first moves (done)
1. ~~Run **RESEARCH-1**~~ ✅ · 2. ~~Run **FUNC-AUDIT**~~ ✅ · 3. ~~Phase 1 quick wins~~ ✅ ·
4. ~~DASH-1 audit~~ ✅ (GEN-1 ADR still open on D-FX) · 5. **D-CANCEL** still open (ask Koceto).

# Review Queue

> **The single place the autonomous agent logs anything that needs your attention.**
> It runs unattended (god mode) and never stops to ask — instead it appends here and
> keeps working. Skim this when you come back; resolve items, then delete or strike them.

## How the agent uses this file
When it hits a question, product decision, ambiguity, or a blocker it can't safely resolve,
it appends an entry using the template below and then either:
- proceeds with a sensible **reversible** default (noted in the entry), or
- skips that item and moves to the next actionable one.

## How you use this file
- Read top-to-bottom. **OPEN** = needs your input. **PROCEEDED** = it made a reversible
  choice you should sanity-check. **BLOCKED** = it skipped the item; your answer unblocks it.
- Answer inline under the entry, then change status to **RESOLVED** (or delete it). Durable
  decisions should also be copied to the relevant doc's decisions register + memory.

## Entry template
```
### [ID] <short title> — <OPEN | PROCEEDED | BLOCKED>
- **When:** <what work was in flight>
- **Context:** <what it hit, file:line if relevant>
- **Options:** <the choices, if it's a decision>
- **What I did:** <the reversible default it took, or "skipped — waiting on you">
- **Needs from you:** <the specific question/decision>
```

---

## Open items

_(The agent appends below. Seeded with the known-open product decisions from
`PRODUCT_ROADMAP.md` §2 so they live in one place.)_

### D-CANCEL — Invoice "Cancel" behavior — ✅ RESOLVED (2026-07-08)
- **Needs from you:** Ask Koceto how Cancel should work. Today it marks the invoice
  `cancelled` (immutable) and you reverse via a credit note. Confirm what's wrong / desired.
- **Blocks:** OI-3.
- **Answer (2026-07-08):** Give the ability to cancel, but also give the ability uncancel. we must be able to freely edit everything, until invoice is marked as accounted (we can change accounted or not always). And i want to be able to delete invoices that are not in
- **Decision (captured → roadmap EDIT-RULE):** Cancel is **reversible** (add Uncancel).
  **Accounted status is the lock**, not finalized: an invoice is freely editable — and
  **deletable** — while NOT `accounted`; once `accounted` it locks (edit/delete blocked). The
  Accounted toggle itself is always changeable, so a user can un-account to edit again.
  *(Trailing clause "delete invoices that are not in …" read as "not in accounted status" —
  run 2: confirm if it surfaces ambiguity, but proceed with accounted-gates-everything.)*

### D-EDIT — Editing finalized/cancelled OUTGOING invoices — ✅ RESOLVED (2026-07-08)
- **Context:** You asked for "everything editable no matter the status." Received invoices
  (your own records) — fine, we'll make them freely editable. Outgoing **finalized** invoices
  are a legal problem: a BG фактура is a sequential legal document, immutable, corrected via
  credit note — the app locks them on purpose.
- **Options:** (a) drafts-only editable (≈today); (b) finalized editable **with** version
  history + audit trail; (c) finalized editable but auto-issues a correction/credit doc.
- **Needs from you:** Pick a/b/c (or confirm you accept the compliance tradeoff of raw edits).
- **Blocks:** OI-10 (outgoing side only).
- **Answer (2026-07-08):**  - we will be able to edit all invoices that are not in status accounted
- **Decision (captured → roadmap EDIT-RULE):** Editability is gated on **`accounted`**, not
  on draft/finalized. Anything not `accounted` is fully editable (and deletable); `accounted`
  locks it. This resolves the earlier compliance tension by making the owner's accounting
  workflow the source of truth. ⚠️ **Compliance caveat for run 2:** BG law treats a finalized
  фактура as immutable; editing a finalized-but-not-accounted invoice in place diverges from
  that. Implement per the owner's rule, but keep an activity/audit trail of edits to finalized
  docs and log the compliance note — do not silently rewrite legal history.

### D-FX — FX rate source for currency conversion — ✅ RESOLVED (2026-07-08 — approved)
- **Needs from you:** Approve the source. Recommendation: ECB daily reference rates, cached
  daily, with the rate frozen onto each document at finalize. Base = `companies.defaultCurrency`.
- **Blocks:** GEN-1 (currency correctness), DASH-1.
- **Answer (2026-07-08):** - i approve 

### D-AUTH — Google login: library vs. hand-rolled — ⏸️ DEFERRED (2026-07-08)
- **Needs from you:** Decide after the agent drafts an ADR (Auth.js vs. `arctic` + existing
  `users` table). Security-review required before merge.
- **Blocks:** AUTH-1 (deferred).
- **Answer (2026-07-08):** - supabase gives us functionality related to google logins so lets use it. but leave it for now
- **Decision:** when revisited, use **Supabase Auth** Google login (not a hand-rolled or
  third-party lib). Parked — not this phase.

### NAP-DOC — Need the NAP.pdf content (can't OCR locally) — ⏸️ DEFERRED (2026-07-08 — do everything else first)
- **Context:** Owner attached `NAP.pdf` ("we must meet all these from NAP"). It's a scanned
  image PDF with no text layer, and this machine has no OCR / PDF-render tooling, so it couldn't
  be read. `docs/knowledge/nap-compliance.md` is a stub awaiting the content.
- **Needs from you:** paste the requirements as text, or screenshot the key pages (images are
  readable), or confirm which NAP doc it is (invoice-content rules / SAF-T / e-invoicing mandate).
- **Blocks:** NAP-1 scoping.
- **Answer (2026-07-08):** - lets finish everything else then we will land on these specifics

### CN-NUMBERING — Credit/debit-note numbering: parent's number vs own sequence — ✅ RESOLVED (2026-07-08 — REVERSES run-1 default)
- **When:** N15 integration tests (2026-07-08).
- **Context:** The tests exposed that **every credit/debit-note creation failed in the
  app**: the action gave notes their own `CN`/`DN` series + fresh numbers, but the live-DB
  trigger `trg_enforce_invoice_numbering` requires notes to **inherit the parent invoice's
  series AND number** (full trigger source: `docs/knowledge/invoice-numbering-triggers.md`).
- **Options:** (a) keep the DB design — notes share the parent's number (what the schema
  comments + trigger say); (b) BG-common practice — notes are their own sequential tax
  documents in the unified numbering range (what inv.bg-style products do; likely what НАП
  expects — verify via NAP-1).
- **What I did:** proceeded with (a) — aligned `createNoteFromInvoice` to the enforced DB
  contract (reversible; no schema change). CN/DN creation works again and is pinned by tests.
- **Needs from you:** confirm (a) vs (b) with the accountant / NAP requirements. If (b),
  the trigger + action + tests change together (schema-level decision).
- **Answer (2026-07-08):** - we must have every new docuemnt no matter what type to be with new number, there must be no numbers that duplicate. 
- **Decision (option b — captured → roadmap NUM-1):** EVERY document (invoice, credit note,
  debit note, proforma) gets its **own new unique number** in the sequence — **no duplicated
  numbers ever**. This reverses run-1's "notes inherit the parent number" alignment. ⚠️ **This
  is a DB-trigger change:** the live `trg_enforce_invoice_numbering` currently *requires* notes
  to inherit the parent's series+number and rejects proforma (see
  `knowledge/invoice-numbering-triggers.md`). Run 2 must (1) bring the trigger into a repo
  migration (closes N24), (2) rewrite it to assign a fresh unique number per document, (3)
  update `createNoteFromInvoice` + the numbering tests together. Keep the parent *link*
  (`referencedInvoiceId`) — only the number changes.

### NUM-1 — Unified numbering rewrite — ✅ DONE (2026-07-08)
- **Shipped:** migration `0006_unified_document_numbering` — unified per-company +1 numbering
  for every doc type, proforma accepted, notes get their own number (parent link kept), triggers
  now in the repo (**N24 closed**). Verified end-to-end on the real DB (lifecycle 17 tests + money
  suite). Owner confirmed the unified model ("+1 for every single document"). Old trigger was
  captured for rollback (unused — no issues). Historical duplicate-numbered notes remain as
  history (forward-only). Unblocks PROF-1.
- **Original entry (for history):**
- **When:** Phase 1.6, after EDIT-RULE + NEWINV-1 shipped (2026-07-08).
- **Context:** D-NUM decided: every document gets its own unique number, no duplicates.
  I captured the exact live trigger source (`enforce_invoice_numbering` +
  `prevent_invoice_number_mutation`, PG17) — see `knowledge/invoice-numbering-triggers.md`.
  Numbers are assigned **app-side** (`createInvoiceDraft` reads `invoice_sequences`), the
  trigger validates. Today: per-(company, series) sequence for invoices; notes **inherit the
  parent's number**; proforma rejected.
- **Interpretation taken:** "no numbers that duplicate" → **unified per-company sequence**
  (all doc types draw one increasing counter per company), matching inv.bg / the BG norm
  (RESEARCH-1). Alternative (per-series own sequences, numbers repeat across series) is less
  likely given the wording — flag if you meant that.
- **Plan (ready to execute):** (1) migration 0006 brings both triggers into the repo verbatim
  (closes **N24**) via `CREATE OR REPLACE` (idempotent no-op on live, PG17); (2) rewrite
  `enforce_invoice_numbering` → unified per-company strictly-increasing for invoice/proforma/
  note, notes keep the parent link (`referenced_invoice_id`) but get their **own** next number,
  proforma accepted; (3) update `invoice_sequences` usage to per-company, `createInvoiceDraft` /
  `createNoteFromInvoice` / `getNextNumber` allocation, + numbering tests. Forward-only — existing
  rows untouched (only 2 historical duplicate-number pairs exist, both in company 5 test data).
- **Why not done unattended this session:** it rewrites **live numbering** while you're
  actively creating documents, and numbering is legally regulated (and NAP-DOC is deferred).
  Old trigger is captured for instant rollback and the change is forward-only, so it's
  reversible — but it deserves a focused pass, not a rushed one at the end of a long turn.
- **Needs from you:** confirm unified-per-company (or correct it), and a nod that it's OK to
  rewrite the live numbering trigger now. Then it's a clean focused task. Unblocks PROF-1 →
  NEWINV-1 form restriction.

### CN-FORM — New-invoice form offers doc types the DB rejects (N25) — ✅ RESOLVED (2026-07-08)
- **Context:** The DocumentCard radio offers `proforma` / `credit_note` / `debit_note`.
  `proforma` can never be inserted (trigger: `Unknown doc_type`); notes via
  `createInvoiceDraft` violate the numbering trigger. Users picking these get raw errors.
- **Options:** (a) restrict the form to `invoice` — notes come from a finalized invoice's
  row menu (works now, post-N15), proforma waits for PROF-1; (b) implement note-draft +
  proforma support in `createInvoiceDraft`.
- **Needs from you:** pick (a) or (b). Recommendation: (a) — small, honest, reversible.
- **Answer (2026-07-08):** - we must have every new docuemnt no matter what type to be with new number, there must be no numbers that duplicate. From new invoice page will be able to create only Proforma or Invoice nothing else 
- **Decision (captured → roadmap):** the new-invoice form offers **Invoice and Proforma only**
  (drop credit_note/debit_note from DocumentCard — notes are created from a finalized invoice's
  row menu). This makes **PROF-1 (proforma support) a prerequisite** — proforma must become a
  real, insertable doc type (needs the NUM-1 trigger rewrite to stop rejecting it). Sequence:
  NUM-1 trigger → PROF-1 → restrict the form.
- ✅ **Done 2026-07-08:** NUM-1 + PROF-1 shipped; DocumentCard now offers Invoice + Proforma
  only (NEWINV-1). Sequence complete.

### PREVIEW-ENV — Embedded preview browser unresponsive; CN flow not re-driven in-browser — PROCEEDED
- **When:** N15 verification (2026-07-08).
- **Context:** The preview harness's browser tab wedged (streamed-HTML Suspense
  completions never applied, form submits didn't POST, `preview_screenshot` timed out with
  "unresponsive renderer") across 2 server restarts + a `.next` cache wipe. Server-side
  the app is healthy: authenticated `curl` of `/c/5/invoices` returns a complete stream in
  <1s, all boundaries resolved, zero server errors. Also hit once: `TypeError: adapterFn
  is not a function` from a stale `.next/dev` cache after killing the server mid-compile —
  fixed by deleting `.next`.
- **What I did:** verified the changed server action via the real-DB integration suite
  (asserted outputs — the C5 path for non-visual logic) and committed. The UI wiring to
  the action is unchanged by the diff.
- **Needs from you:** ~~nothing blocking; next session with a working preview should click
  through Invoices → row menu → "Create credit note" once to see the toast + list refresh.~~
  **Done 2026-07-08:** root cause found (rAF starvation in the occluded preview tab —
  see `knowledge/func-audit-2026-07.md`), and the CN click was re-driven for real: it
  first exposed a second bug (note inherited the parent's supplyDate → ISSUE_DATE_TOO_LATE
  for parents >5 days old, fixed in `acdaad6`), then created CN id 43 (INV #2) UI→DB. ✅

### NI1-PREVIEW — Preview of an unsaved invoice implicitly saves a draft — ✅ RESOLVED (2026-07-08 — remove Preview)
- **When:** NI-1 (2026-07-08).
- **Context:** The spec said "Preview renders from current form state". A true client-side
  print render needs the invoice print layout extracted into a reusable component (RV-3 /
  print territory). Instead, clicking Preview on an unsaved form now **saves the draft
  silently and opens the existing print view** — the user-visible goal (no manual save
  step) is met; the side effect is a draft row + an allocated number, exactly as if the
  user had clicked Save draft then Preview (today's flow).
- **What I did:** shipped the implicit-save default; noted the client-side render as
  follow-up for the RV-3 redesign.
- **Needs from you:** nothing unless you dislike drafts being created by Preview — say so
  and it becomes a pure client-side render when RV-3 lands.
- **Answer (2026-07-08):** - currently preview button on add new invoice makes no sense so remove it and leave only draft and finalyze
- **Decision (captured → roadmap NEWINV-1):** **remove the Preview button** from the new-invoice
  page (ActionsBar); leave only **Save draft** and **Finalize**. (Preview/print still reachable
  from a saved invoice's detail/row menu.)

### INV11-CANCEL — Stray cancel of seed invoice 11 during UI testing, restored — PROCEEDED
- **When:** AGG-1 verification (2026-07-08, ~02:46 local).
- **Context:** While the run was driving the UI through the embedded preview, a stray
  synthetic click cancelled seed invoice 11 (Алфа № 0000000001, paid, 1920) — most likely
  a pointer-event landing on the row menu's "Cancel" (adjacent to Copy/CN). The new signed
  aggregates caught it immediately: company 5's collected went **negative** (−480).
- **What I did:** restored the row to its known prior state (`finalized`; payment_status
  was untouched) with a guarded SQL update. The CANCEL_INVOICE activity entry remains in
  the log (user 7, honest history). Also surfaced a real product edge: **credit notes keep
  counting after their parent invoice is cancelled** — noted in
  `knowledge/money-aggregation-rules.md`, pairs with D-CANCEL.
- **Needs from you:** nothing for the data (verified reconciled: collected 1440 /
  outstanding 360). When answering D-CANCEL, also decide whether notes follow their
  parent's cancellation.

### D-EMAIL — Email transport + ingestion scope — ⏸️ DEFERRED (2026-07-08 — later)
- **Needs from you:** (1) SMTP/deliverability provider for sending. (2) Scope of "look over
  all emails" — recommend limiting to invoice-relevant emails auto-matched to partners.
- **Blocks:** EMAIL-1, EMAIL-2.
- **Answer (2026-07-08):** -  leave emails for later, we will do them later

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

### D-CANCEL — Invoice "Cancel" behavior — OPEN
- **Needs from you:** Ask Koceto how Cancel should work. Today it marks the invoice
  `cancelled` (immutable) and you reverse via a credit note. Confirm what's wrong / desired.
- **Blocks:** OI-3.

### D-EDIT — Editing finalized/cancelled OUTGOING invoices — OPEN
- **Context:** You asked for "everything editable no matter the status." Received invoices
  (your own records) — fine, we'll make them freely editable. Outgoing **finalized** invoices
  are a legal problem: a BG фактура is a sequential legal document, immutable, corrected via
  credit note — the app locks them on purpose.
- **Options:** (a) drafts-only editable (≈today); (b) finalized editable **with** version
  history + audit trail; (c) finalized editable but auto-issues a correction/credit doc.
- **Needs from you:** Pick a/b/c (or confirm you accept the compliance tradeoff of raw edits).
- **Blocks:** OI-10 (outgoing side only).

### D-FX — FX rate source for currency conversion — OPEN
- **Needs from you:** Approve the source. Recommendation: ECB daily reference rates, cached
  daily, with the rate frozen onto each document at finalize. Base = `companies.defaultCurrency`.
- **Blocks:** GEN-1 (currency correctness), DASH-1.

### D-AUTH — Google login: library vs. hand-rolled — OPEN
- **Needs from you:** Decide after the agent drafts an ADR (Auth.js vs. `arctic` + existing
  `users` table). Security-review required before merge.
- **Blocks:** AUTH-1.

### NAP-DOC — Need the NAP.pdf content (can't OCR locally) — BLOCKED
- **Context:** Owner attached `NAP.pdf` ("we must meet all these from NAP"). It's a scanned
  image PDF with no text layer, and this machine has no OCR / PDF-render tooling, so it couldn't
  be read. `docs/knowledge/nap-compliance.md` is a stub awaiting the content.
- **Needs from you:** paste the requirements as text, or screenshot the key pages (images are
  readable), or confirm which NAP doc it is (invoice-content rules / SAF-T / e-invoicing mandate).
- **Blocks:** NAP-1 scoping.

### CN-NUMBERING — Credit/debit-note numbering: parent's number vs own sequence — PROCEEDED
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

### CN-FORM — New-invoice form offers doc types the DB rejects (N25) — OPEN
- **Context:** The DocumentCard radio offers `proforma` / `credit_note` / `debit_note`.
  `proforma` can never be inserted (trigger: `Unknown doc_type`); notes via
  `createInvoiceDraft` violate the numbering trigger. Users picking these get raw errors.
- **Options:** (a) restrict the form to `invoice` — notes come from a finalized invoice's
  row menu (works now, post-N15), proforma waits for PROF-1; (b) implement note-draft +
  proforma support in `createInvoiceDraft`.
- **Needs from you:** pick (a) or (b). Recommendation: (a) — small, honest, reversible.

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

### NI1-PREVIEW — Preview of an unsaved invoice implicitly saves a draft — PROCEEDED
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

### D-EMAIL — Email transport + ingestion scope — OPEN
- **Needs from you:** (1) SMTP/deliverability provider for sending. (2) Scope of "look over
  all emails" — recommend limiting to invoice-relevant emails auto-matched to partners.
- **Blocks:** EMAIL-1, EMAIL-2.

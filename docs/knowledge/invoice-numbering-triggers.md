# Invoice numbering (triggers)

> **⚠️ SUPERSEDED 2026-07-08 by NUM-1.** Migration `0006_unified_document_numbering`
> brought both triggers **into the repo** (closes **N24**) and rewrote the numbering
> rule to **unified per-company**: every document (invoice, proforma, credit_note,
> debit_note) takes the **next number in one per-company sequence** (+1 each time), no
> duplicates. Notes NO LONGER inherit the parent's number — they get their own number and
> keep the parent link via `referenced_invoice_id`. Proforma is now accepted. App-side
> allocation uses the `'*'` sentinel sequence (see `allocateNumber`). The sections below
> describe the ORIGINAL (pre-NUM-1) design for history; the current source of truth is
> migration 0006. `owner decision: "unique numbering for every single document, +1 every time".`

**Original one-liner (historical):** the live Postgres DB had two triggers on `invoices`
that were the real source of truth for numbering — they existed **only in the database**,
not in `lib/db/migrations/`, and the note-creation action silently violated them until N15.
Written 2026-07-08. Supported N15, N24, N25, NAP-1, PROF-1.

## The triggers (dumped from the live DB, 2026-07-08)

### `trg_enforce_invoice_numbering` → `enforce_invoice_numbering()` (BEFORE INSERT)

- **`doc_type = 'invoice'`**: `NEW.number` must be **strictly greater** than
  `MAX(number)` for `(company_id, series, doc_type='invoice')`. On success it upserts
  `invoice_sequences.next_number = GREATEST(next_number, NEW.number + 1)` — so manual
  overrides auto-advance the sequence.
- **`doc_type IN ('credit_note','debit_note')`**:
  - `referenced_invoice_id` must be **NOT NULL**,
  - the parent must exist and have `doc_type = 'invoice'` (no notes-on-notes),
  - `NEW.number` must **equal the parent's number**,
  - `NEW.company_id` and `NEW.series` must **match the parent's**.
- **any other `doc_type`** (e.g. `'proforma'`): `RAISE EXCEPTION 'Unknown doc_type'` —
  **proforma rows cannot be inserted at all today.**

### `trg_prevent_invoice_number_mutation` (BEFORE UPDATE)

`number`, `series`, `company_id`, and `doc_type` are immutable after insert — any
change raises.

Full `pg_get_functiondef` output can be re-dumped with:

```sql
SELECT t.tgname, pg_get_functiondef(p.oid)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal AND c.relname = 'invoices';
```

## What this means

1. **Notes inherit the parent's series + number.** `DEFAULT_SERIES['credit_note'] = 'CN'`
   in `src/features/bulgarian-invoicing/rules.ts` is *display-level at most* — a CN row
   with `series='CN'` is rejected by the DB. The schema.ts comments describe this
   correctly; the action code did not follow it until the N15 fix
   (`createNoteFromInvoice` now copies `original.series` / `original.number` and no
   longer draws from a `CN`/`DN` sequence).
2. **Every credit/debit note ever attempted via the UI failed** at the DB with
   `credit_note must belong to the same company and series as its parent invoice`
   (found by the N15 integration suite; fixed in the same commit).
3. **The repo cannot rebuild the DB faithfully.** `lib/db/migrations/0000_baseline.sql`
   + `0001` do not contain these triggers. A fresh `db:migrate` database would accept
   data the production DB rejects (tracked as **N24**).
4. **The new-invoice form still offers `proforma` / `credit_note` / `debit_note`**
   radio options whose submit path (`createInvoiceDraft`) allocates its own
   series/number → guaranteed trigger rejection (tracked as **N25**; proforma overlaps
   PROF-1).

## Open compliance question (→ REVIEW_QUEUE: CN-NUMBERING)

Under ЗДДС чл. 114 practice, кредитни/дебитни известия are commonly numbered as their
own sequential tax documents in the company's unified numbering range — i.e. a CN gets
the **next number**, not a copy of the parent's. The current DB design (notes share the
parent's number; multiple notes per parent share it) is a deliberate but unusual choice
that inv.bg-style products do differently. Confirm against the NAP requirements
(NAP-1) before building VAT-1 reporting on top of note numbering.

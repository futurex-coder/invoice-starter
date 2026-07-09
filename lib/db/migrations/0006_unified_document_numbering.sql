-- NUM-1: unified per-company document numbering.
-- Every document (invoice, proforma, credit_note, debit_note) takes the NEXT
-- number in a single strictly-increasing per-company sequence — no duplicates,
-- +1 each time. Notes no longer inherit the parent's number; they keep the
-- parent LINK via referenced_invoice_id and get their own next number.
--
-- This migration also brings the numbering triggers into the repo (closes N24):
-- they previously existed only in the live DB. Written by hand because Drizzle
-- does not model triggers/functions. Idempotent (CREATE OR REPLACE) so it is a
-- no-op-equivalent where the functions already exist. Requires PostgreSQL 14+
-- for CREATE OR REPLACE TRIGGER (target DB is PG17).

-- ── Numbering enforcement: unified per-company, strictly increasing ──────────
CREATE OR REPLACE FUNCTION enforce_invoice_numbering()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  max_existing_number INTEGER;
  parent_company_id INTEGER;
BEGIN
  -- One number space per company, shared by ALL document types.
  SELECT COALESCE(MAX(number), 0)
    INTO max_existing_number
    FROM invoices
   WHERE company_id = NEW.company_id;

  IF NEW.number <= max_existing_number THEN
    RAISE EXCEPTION
      'Document number % must be greater than the current maximum (%) for company_id=%',
      NEW.number, max_existing_number, NEW.company_id;
  END IF;

  -- Credit/debit notes must still reference a real parent invoice in the same
  -- company (the LINK is preserved), but they get their own number above.
  IF NEW.doc_type IN ('credit_note', 'debit_note') THEN
    IF NEW.referenced_invoice_id IS NULL THEN
      RAISE EXCEPTION
        '% must reference a parent invoice (referenced_invoice_id cannot be NULL)',
        NEW.doc_type;
    END IF;

    SELECT company_id
      INTO parent_company_id
      FROM invoices
     WHERE id = NEW.referenced_invoice_id
       AND doc_type = 'invoice';

    IF parent_company_id IS NULL THEN
      RAISE EXCEPTION
        'Referenced invoice (id=%) not found or is not a regular invoice',
        NEW.referenced_invoice_id;
    END IF;

    IF NEW.company_id != parent_company_id THEN
      RAISE EXCEPTION
        '% must belong to the same company as its parent invoice',
        NEW.doc_type;
    END IF;
  END IF;
  -- 'invoice' and 'proforma' need no extra checks; proforma is now accepted.

  -- Advance the unified per-company sequence tracker (series sentinel '*').
  INSERT INTO invoice_sequences (company_id, series, next_number, updated_at)
  VALUES (NEW.company_id, '*', NEW.number + 1, NOW())
  ON CONFLICT ON CONSTRAINT invoice_sequences_company_series_unique
  DO UPDATE SET
    next_number = GREATEST(invoice_sequences.next_number, NEW.number + 1),
    updated_at = NOW();

  RETURN NEW;
END;
$function$;
--> statement-breakpoint

-- ── Immutability guard (unchanged; captured here for repo faithfulness) ──────
CREATE OR REPLACE FUNCTION prevent_invoice_number_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF OLD.number IS DISTINCT FROM NEW.number THEN
    RAISE EXCEPTION 'Cannot change invoice number after creation (was %, attempted %)',
      OLD.number, NEW.number;
  END IF;

  IF OLD.series IS DISTINCT FROM NEW.series THEN
    RAISE EXCEPTION 'Cannot change invoice series after creation (was %, attempted %)',
      OLD.series, NEW.series;
  END IF;

  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'Cannot change invoice company after creation';
  END IF;

  IF OLD.doc_type IS DISTINCT FROM NEW.doc_type THEN
    RAISE EXCEPTION 'Cannot change invoice doc_type after creation (was %, attempted %)',
      OLD.doc_type, NEW.doc_type;
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint

-- ── Bind the triggers (CREATE OR REPLACE TRIGGER — PG14+) ────────────────────
CREATE OR REPLACE TRIGGER trg_enforce_invoice_numbering
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION enforce_invoice_numbering();
--> statement-breakpoint
CREATE OR REPLACE TRIGGER trg_prevent_invoice_number_mutation
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION prevent_invoice_number_mutation();
--> statement-breakpoint

-- ── Seed the unified per-company sequence from existing data ─────────────────
-- Existing companies keep counting above their current max; the sequence is
-- now keyed by the '*' sentinel, decoupled from the display series.
INSERT INTO invoice_sequences (company_id, series, next_number, updated_at)
SELECT company_id, '*', MAX(number) + 1, NOW()
  FROM invoices
 WHERE number IS NOT NULL
 GROUP BY company_id
ON CONFLICT ON CONSTRAINT invoice_sequences_company_series_unique
DO UPDATE SET
  next_number = GREATEST(invoice_sequences.next_number, EXCLUDED.next_number),
  updated_at = NOW();

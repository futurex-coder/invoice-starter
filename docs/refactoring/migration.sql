-- ─────────────────────────────────────────────────────────────
-- CLEAN SLATE MIGRATION
-- ─────────────────────────────────────────────────────────────
-- Drops ALL old tables and triggers. The new schema is created
-- by Drizzle (drizzle-kit push / generate + migrate).
-- Run this SQL BEFORE running drizzle-kit.
-- Then run the triggers section AFTER drizzle creates tables.
-- ─────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════
-- PART 1: DROP EVERYTHING - Done
-- ═══════════════════════════════════════════════

-- Drop triggers first (they depend on functions)
DROP TRIGGER IF EXISTS trg_enforce_invoice_numbering ON invoices;
DROP TRIGGER IF EXISTS trg_prevent_invoice_number_mutation ON invoices;
DROP FUNCTION IF EXISTS enforce_invoice_numbering();
DROP FUNCTION IF EXISTS prevent_invoice_number_mutation();

-- Drop old tables in dependency order
DROP TABLE IF EXISTS invoice_lines CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS invoice_sequences CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS partners CASCADE;
DROP TABLE IF EXISTS team_company_profiles CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS team_members CASCADE;
DROP TABLE IF EXISTS company_members CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- ═══════════════════════════════════════════════
-- PART 2: TRIGGERS (run AFTER drizzle-kit creates tables)
-- ═══════════════════════════════════════════════

-- ─── Monotonic invoice numbering (BEFORE INSERT) ───

CREATE OR REPLACE FUNCTION enforce_invoice_numbering()
RETURNS TRIGGER AS $$
DECLARE
  max_existing_number INTEGER;
  parent_number INTEGER;
  parent_company_id INTEGER;
  parent_series VARCHAR;
BEGIN
  -- ─── INVOICES: strict monotonic check ───
  IF NEW.doc_type = 'invoice' THEN

    SELECT COALESCE(MAX(number), 0)
      INTO max_existing_number
      FROM invoices
     WHERE company_id = NEW.company_id
       AND series = NEW.series
       AND doc_type = 'invoice';

    IF NEW.number <= max_existing_number THEN
      RAISE EXCEPTION
        'Invoice number % must be greater than the current maximum (%) for company_id=%, series=%',
        NEW.number, max_existing_number, NEW.company_id, NEW.series;
    END IF;

    -- Auto-advance the sequence tracker
    INSERT INTO invoice_sequences (company_id, series, next_number, updated_at)
    VALUES (NEW.company_id, NEW.series, NEW.number + 1, NOW())
    ON CONFLICT ON CONSTRAINT invoice_sequences_company_series_unique
    DO UPDATE SET
      next_number = GREATEST(invoice_sequences.next_number, NEW.number + 1),
      updated_at = NOW();

  -- ─── CREDIT/DEBIT NOTES: must reference parent, inherit its number ───
  ELSIF NEW.doc_type IN ('credit_note', 'debit_note') THEN

    IF NEW.referenced_invoice_id IS NULL THEN
      RAISE EXCEPTION
        '% must reference a parent invoice (referenced_invoice_id cannot be NULL)',
        NEW.doc_type;
    END IF;

    SELECT number, company_id, series
      INTO parent_number, parent_company_id, parent_series
      FROM invoices
     WHERE id = NEW.referenced_invoice_id
       AND doc_type = 'invoice';

    IF parent_number IS NULL THEN
      RAISE EXCEPTION
        'Referenced invoice (id=%) not found or is not a regular invoice',
        NEW.referenced_invoice_id;
    END IF;

    IF NEW.number != parent_number THEN
      RAISE EXCEPTION
        '% number (%) must match the parent invoice number (%)',
        NEW.doc_type, NEW.number, parent_number;
    END IF;

    IF NEW.company_id != parent_company_id OR NEW.series != parent_series THEN
      RAISE EXCEPTION
        '% must belong to the same company and series as its parent invoice',
        NEW.doc_type;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unknown doc_type: %', NEW.doc_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_invoice_numbering
  BEFORE INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_numbering();


-- ─── Immutable invoice identity fields (BEFORE UPDATE) ───

CREATE OR REPLACE FUNCTION prevent_invoice_number_mutation()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_invoice_number_mutation
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_invoice_number_mutation();

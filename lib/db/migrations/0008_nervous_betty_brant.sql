CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"posting_number" integer NOT NULL,
	"posting_date" date NOT NULL,
	"kind" varchar(20) DEFAULT 'document' NOT NULL,
	"doc_type_code" varchar(2),
	"document_type" varchar(30),
	"document_number" varchar(20),
	"document_date" date,
	"deal_type" varchar(10),
	"vat_operation" varchar(40),
	"basis" varchar(50),
	"note" text,
	"partner_id" integer,
	"partner_name" varchar(255),
	"partner_uic" varchar(15),
	"partner_vat" varchar(20),
	"vies" boolean DEFAULT false NOT NULL,
	"vat_period" char(7),
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"fx_rate" numeric(15, 6) DEFAULT '1' NOT NULL,
	"source_invoice_id" integer,
	"source_received_invoice_id" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"reversed_by_entry_id" integer,
	"created_by_user_id" integer,
	"posted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_entry_id" integer NOT NULL,
	"side" varchar(6) NOT NULL,
	"account_code" varchar(20) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"description" varchar(500),
	"amount" numeric(15, 4) NOT NULL,
	"amount_base" numeric(15, 4) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_sequences" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_tax_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"journal_entry_id" integer NOT NULL,
	"vat_operation" varchar(40) NOT NULL,
	"register" varchar(10),
	"base_cell" varchar(4),
	"vat_cell" varchar(4),
	"base" numeric(15, 4) DEFAULT '0' NOT NULL,
	"base_base" numeric(15, 4) DEFAULT '0' NOT NULL,
	"vat" numeric(15, 4) DEFAULT '0' NOT NULL,
	"vat_base" numeric(15, 4) DEFAULT '0' NOT NULL,
	CONSTRAINT "jtl_vat_requires_register" CHECK (("journal_tax_lines"."vat" = 0) OR ("journal_tax_lines"."register" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_source_invoice_id_invoices_id_fk" FOREIGN KEY ("source_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_source_received_invoice_id_received_invoices_id_fk" FOREIGN KEY ("source_received_invoice_id") REFERENCES "public"."received_invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_sequences" ADD CONSTRAINT "journal_sequences_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_tax_lines" ADD CONSTRAINT "journal_tax_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "je_company_posting_number_unique" ON "journal_entries" USING btree ("company_id","posting_number");--> statement-breakpoint
CREATE INDEX "idx_je_company_period" ON "journal_entries" USING btree ("company_id","vat_period");--> statement-breakpoint
CREATE INDEX "idx_je_company_status" ON "journal_entries" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "je_source_invoice_unique" ON "journal_entries" USING btree ("source_invoice_id") WHERE "journal_entries"."source_invoice_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "je_source_received_unique" ON "journal_entries" USING btree ("source_received_invoice_id") WHERE "journal_entries"."source_received_invoice_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_jl_entry" ON "journal_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_jl_account" ON "journal_lines" USING btree ("journal_entry_id","account_code");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_sequences_company_unique" ON "journal_sequences" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_jtl_entry" ON "journal_tax_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_jtl_cell" ON "journal_tax_lines" USING btree ("base_cell","vat_cell");--> statement-breakpoint

-- ── KONT-1 integrity: balance + immutability (hand-written; Drizzle can't model
--    cross-row CHECKs or triggers). Idempotent. PG14+ (target PG17). ───────────

-- 1) Balance (двустранно счетоводство): a POSTED контировка must have Σ amount_base
--    debit = credit and ≥ 2 lines. Deferred so the whole entry+lines insert in one
--    transaction is validated at COMMIT. Drafts are never balance-checked.
CREATE OR REPLACE FUNCTION enforce_journal_balance()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  eid INTEGER;
  st  TEXT;
  dr  NUMERIC;
  cr  NUMERIC;
  n   INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'journal_entries' THEN
    eid := COALESCE(NEW.id, OLD.id);
  ELSE
    eid := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  END IF;

  SELECT status INTO st FROM journal_entries WHERE id = eid;
  -- entry gone (cascade) or still a draft → nothing to enforce
  IF st IS NULL OR st <> 'posted' THEN
    RETURN NULL;
  END IF;

  SELECT
    COALESCE(SUM(amount_base) FILTER (WHERE side = 'debit'), 0),
    COALESCE(SUM(amount_base) FILTER (WHERE side = 'credit'), 0),
    COUNT(*)
  INTO dr, cr, n
  FROM journal_lines
  WHERE journal_entry_id = eid;

  IF n < 2 THEN
    RAISE EXCEPTION 'Контировка (entry %) трябва да има поне два реда', eid;
  END IF;
  IF round(dr, 2) <> round(cr, 2) THEN
    RAISE EXCEPTION 'Контировка (entry %) не е балансирана: Дебит %, Кредит %',
      eid, round(dr, 2), round(cr, 2);
  END IF;

  RETURN NULL;
END;
$function$;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_journal_balance_lines ON journal_lines;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER trg_journal_balance_lines
  AFTER INSERT OR UPDATE OR DELETE ON journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_balance();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_journal_balance_entry ON journal_entries;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER trg_journal_balance_entry
  AFTER INSERT OR UPDATE ON journal_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION enforce_journal_balance();--> statement-breakpoint

-- 2) Immutability of posted entries: a posted контировка may only transition to
--    'reversed' (сторниране); it is never edited or deleted. Corrections are a new
--    reversing entry. This keeps the дневник gap-free and stable per period.
CREATE OR REPLACE FUNCTION prevent_posted_journal_entry_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'posted' THEN
      RAISE EXCEPTION 'Осчетоводена контировка не може да се изтрие — сторнирайте я';
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE: posted → only 'reversed' is allowed
  IF OLD.status = 'posted' AND NEW.status <> 'reversed' THEN
    RAISE EXCEPTION 'Осчетоводена контировка е неизменяема (позволено е само сторниране)';
  END IF;
  RETURN NEW;
END;
$function$;--> statement-breakpoint

CREATE OR REPLACE TRIGGER trg_prevent_posted_journal_entry_mutation
  BEFORE UPDATE OR DELETE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_entry_mutation();--> statement-breakpoint

-- child rows (Дт/Кт + tax lines) of a posted entry are frozen
CREATE OR REPLACE FUNCTION prevent_posted_journal_child_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  st TEXT;
BEGIN
  SELECT status INTO st FROM journal_entries
    WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  IF st = 'posted' THEN
    RAISE EXCEPTION 'Редовете на осчетоводена контировка са неизменяеми';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;--> statement-breakpoint

CREATE OR REPLACE TRIGGER trg_prevent_posted_journal_lines_mutation
  BEFORE UPDATE OR DELETE ON journal_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_child_mutation();--> statement-breakpoint

CREATE OR REPLACE TRIGGER trg_prevent_posted_journal_tax_lines_mutation
  BEFORE UPDATE OR DELETE ON journal_tax_lines
  FOR EACH ROW EXECUTE FUNCTION prevent_posted_journal_child_mutation();
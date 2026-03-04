-- Migration: Add relational FK columns to invoices and create invoice_lines table
-- This moves from pure JSONB snapshots to a hybrid FK + snapshot model.
-- Snapshots are kept for legal/historical integrity; FKs enable reuse and querying.

-- 1) Add FK columns to invoices
ALTER TABLE "invoices"
  ADD COLUMN "partner_id" integer REFERENCES "partners"("id") ON DELETE SET NULL,
  ADD COLUMN "supplier_profile_id" integer REFERENCES "team_company_profiles"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_invoices_partner_id"
  ON "invoices" ("partner_id") WHERE "partner_id" IS NOT NULL;

-- 2) Create invoice_lines table (replaces items JSONB as source of truth)
CREATE TABLE IF NOT EXISTS "invoice_lines" (
  "id" serial PRIMARY KEY NOT NULL,
  "invoice_id" integer NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "article_id" integer REFERENCES "articles"("id") ON DELETE SET NULL,
  "sort_order" integer NOT NULL DEFAULT 0,

  "description" varchar(500) NOT NULL,
  "quantity" numeric(15, 4) NOT NULL,
  "unit" varchar(20) NOT NULL DEFAULT 'бр.',
  "unit_price" numeric(15, 4) NOT NULL,
  "vat_rate" integer NOT NULL DEFAULT 20,
  "discount_percent" numeric(5, 2) NOT NULL DEFAULT 0,
  "discount_amount" numeric(15, 4) NOT NULL DEFAULT 0,
  "net_amount" numeric(15, 4) NOT NULL DEFAULT 0,
  "vat_amount" numeric(15, 4) NOT NULL DEFAULT 0,
  "gross_amount" numeric(15, 4) NOT NULL DEFAULT 0,

  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_invoice_lines_invoice_id"
  ON "invoice_lines" ("invoice_id");
CREATE INDEX IF NOT EXISTS "idx_invoice_lines_article_id"
  ON "invoice_lines" ("article_id") WHERE "article_id" IS NOT NULL;

-- =============================================================================
-- Bulgarian Invoicing: DB extension design (Step 1)
-- Minimal additions for: Supplier (team company), Partners (clients), Articles,
-- and extra invoice fields. SQL DDL only; no Drizzle code.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. team_company_profiles (one per team — Supplier / Доставчик)
-- -----------------------------------------------------------------------------
-- Used to auto-fill supplier snapshot on invoices. Bank details here are
-- copied into invoice snapshot when payment_method = 'bank'.

CREATE TABLE team_company_profiles (
  id serial PRIMARY KEY,
  team_id integer NOT NULL,

  -- Identity
  legal_name varchar(255) NOT NULL,
  eik varchar(13) NOT NULL,                    -- 9-digit BULSTAT or 10-digit EGN for sole prop
  vat_number varchar(14),                      -- BG + 9/10 digits; NULL if not VAT registered
  is_vat_registered boolean NOT NULL DEFAULT true,

  -- Address
  country char(2) NOT NULL DEFAULT 'BG',       -- ISO 3166-1 alpha-2
  city varchar(100) NOT NULL,
  street varchar(255) NOT NULL,
  post_code varchar(20),

  -- Contact (optional)
  mol varchar(255),                            -- MOL / contact person

  -- Bank (optional; used when payment_method = 'bank')
  bank_name varchar(255),
  iban varchar(34),
  bic_swift varchar(11),

  -- Defaults for new invoices
  default_currency char(3) NOT NULL DEFAULT 'EUR',
  default_vat_rate smallint NOT NULL DEFAULT 20,
  default_payment_method varchar(20) NOT NULL DEFAULT 'bank',

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT team_company_profiles_team_id_fk
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT team_company_profiles_team_id_unique
    UNIQUE (team_id)
);

CREATE INDEX idx_team_company_profiles_team_id
  ON team_company_profiles(team_id);


-- -----------------------------------------------------------------------------
-- 2. partners (clients / recipients — Получатели) — scoped by team
-- -----------------------------------------------------------------------------
-- Quick-select for recipient; invoice still stores recipient_snapshot (editable per invoice).

CREATE TABLE partners (
  id serial PRIMARY KEY,
  team_id integer NOT NULL,

  name varchar(255) NOT NULL,
  eik varchar(13) NOT NULL,                   -- 9/10 digits; EIK or EGN
  vat_number varchar(14),                    -- BG + 9/10 digits; NULL if not VAT
  is_individual boolean NOT NULL DEFAULT false,

  -- Address
  country char(2) NOT NULL DEFAULT 'BG',
  city varchar(100) NOT NULL,
  street varchar(255) NOT NULL,
  post_code varchar(20),

  mol varchar(255),

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT partners_team_id_fk
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- Search by name or EIK (team-scoped)
CREATE INDEX idx_partners_team_id ON partners(team_id);
CREATE INDEX idx_partners_team_name ON partners(team_id, name);
CREATE INDEX idx_partners_team_eik ON partners(team_id, eik);

-- Optional: trigram for fuzzy name search (requires pg_trgm)
-- CREATE INDEX idx_partners_name_trgm ON partners USING gin (name gin_trgm_ops);


-- -----------------------------------------------------------------------------
-- 3. articles (items / services — Артикули) — scoped by team
-- -----------------------------------------------------------------------------
-- Catalog for line items; invoice stores computed items in JSONB.

CREATE TABLE articles (
  id serial PRIMARY KEY,
  team_id integer NOT NULL,

  name varchar(255) NOT NULL,
  unit varchar(20) NOT NULL DEFAULT 'бр.',    -- бр./час/ден/кг/лв. etc.
  tags text[],                                -- optional categorization

  default_unit_price numeric(15, 4) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'EUR',

  type varchar(20) DEFAULT 'service',         -- 'service' | 'goods' (optional accounting)

  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),

  CONSTRAINT articles_team_id_fk
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX idx_articles_team_id ON articles(team_id);
CREATE INDEX idx_articles_team_name ON articles(team_id, name);


-- -----------------------------------------------------------------------------
-- 4. invoices — new columns only (minimal)
-- -----------------------------------------------------------------------------
-- No new tables. Supplier bank details: store inside existing supplier_snapshot
-- JSONB when payment is bank (add keys: bankName, iban, bic) to avoid extra column.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS language char(2) NOT NULL DEFAULT 'bg',
  ADD COLUMN IF NOT EXISTS payment_method varchar(20) NOT NULL DEFAULT 'bank',
  ADD COLUMN IF NOT EXISTS payment_status varchar(20) NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS vat_mode varchar(20) NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS no_vat_reason text,
  ADD COLUMN IF NOT EXISTS amount_in_words text;

-- Indexes for common filters (optional; add if needed for list filters)
-- CREATE INDEX idx_invoices_team_payment_status ON invoices(team_id, payment_status);
-- CREATE INDEX idx_invoices_team_due_date ON invoices(team_id, due_date);


-- -----------------------------------------------------------------------------
-- 5. JSONB shape extensions (reference only; not enforced by DB)
-- -----------------------------------------------------------------------------
/*
supplier_snapshot (extended when payment_method = 'bank'):
{
  "legalName": "string",
  "address": "string",
  "uic": "string",
  "vatNumber": "string | null",
  "bankName": "string | null",
  "iban": "string | null",
  "bic": "string | null"
}

recipient_snapshot: unchanged (legalName, address, uic, vatNumber).
*/


-- -----------------------------------------------------------------------------
-- 6. Column / domain summary
-- -----------------------------------------------------------------------------
-- team_company_profiles: 1:1 with teams; supplies Supplier + optional bank.
-- partners: N:1 teams; searchable by name/eik; recipient remains snapshot per invoice.
-- articles: N:1 teams; default unit/price/currency; type for categorization.
-- invoices new columns:
--   language       — bg | en (document language)
--   payment_method — bank | cash | barter
--   payment_status — unpaid | paid | partial
--   due_date       — optional
--   vat_mode       — standard | no_vat
--   no_vat_reason  — required when vat_mode = no_vat (app logic)
--   amount_in_words — mandatory snapshot (Словом) from total gross (app-generated)

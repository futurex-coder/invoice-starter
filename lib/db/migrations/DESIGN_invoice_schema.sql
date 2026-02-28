-- =============================================================================
-- Bulgarian Invoicing: Proposed SQL Schema Additions (Supabase Postgres)
-- Design-only; not yet applied. Compatible with existing tables.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. invoice_sequences (per team + series)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id serial PRIMARY KEY,
  team_id integer NOT NULL,
  series varchar(20) NOT NULL,
  next_number integer NOT NULL DEFAULT 1,
  updated_at timestamp DEFAULT now() NOT NULL,

  CONSTRAINT invoice_sequences_team_id_teams_id_fk
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT invoice_sequences_team_series_unique
    UNIQUE (team_id, series)
);

CREATE INDEX idx_invoice_sequences_team_id ON invoice_sequences(team_id);


-- -----------------------------------------------------------------------------
-- 2. invoices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id serial PRIMARY KEY,
  team_id integer NOT NULL,
  created_by_user_id integer,
  referenced_invoice_id integer,

  -- Document type and lifecycle
  doc_type varchar(30) NOT NULL DEFAULT 'invoice',   -- 'invoice' | 'credit_note' | 'correction' | 'simplified'
  status varchar(20) NOT NULL DEFAULT 'draft',        -- 'draft' | 'issued' | 'cancelled'

  -- Numbering (series + number from invoice_sequences)
  series varchar(20) NOT NULL DEFAULT 'INV',
  number integer,                                      -- NULL for drafts; assigned on issue

  -- Dates
  issue_date date NOT NULL,
  supply_date date,                                     -- optional; if different from issue_date

  -- Currency and FX (VAT in BG must be in EUR per NRA)
  currency char(3) NOT NULL DEFAULT 'EUR',
  fx_rate numeric(15, 6) NOT NULL DEFAULT 1,             -- rate to EUR; 1.0 if already EUR

  -- Snapshots (immutable once issued; BG audit trail)
  supplier_snapshot jsonb,                               -- { legalName, address, uic, vatNumber }
  recipient_snapshot jsonb,                              -- { legalName, address, uic, vatNumber }
  items jsonb,                                           -- [{ description, quantity, unit, unitPrice, vatRate, netAmount, vatAmount }, ...]
  totals jsonb,                                           -- { totalNet, totalVat, totalGross }

  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,

  CONSTRAINT invoices_team_id_teams_id_fk
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT invoices_created_by_user_id_users_id_fk
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT invoices_referenced_invoice_id_invoices_id_fk
    FOREIGN KEY (referenced_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL ON UPDATE NO ACTION
);

-- Indexes for tenant-scoped queries and lookups
CREATE INDEX idx_invoices_team_id ON invoices(team_id);
CREATE INDEX idx_invoices_team_status ON invoices(team_id, status);
CREATE INDEX idx_invoices_team_issue_date ON invoices(team_id, issue_date DESC);
CREATE INDEX idx_invoices_created_by_user_id ON invoices(created_by_user_id) WHERE created_by_user_id IS NOT NULL;

-- Partial unique index: (team_id, series, number) only for finalized documents with a number
-- Allows drafts to have NULL number; enforces uniqueness once issued.
CREATE UNIQUE INDEX idx_invoices_team_series_number_unique
  ON invoices (team_id, series, number)
  WHERE number IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 3. Recommended JSONB shapes (for reference; not enforced by DB)
-- -----------------------------------------------------------------------------
/*
supplier_snapshot:
{
  "legalName": "string",
  "address": "string",
  "uic": "string",         -- 9-digit BULSTAT
  "vatNumber": "string"    -- nullable if not VAT registered
}

recipient_snapshot: same shape

items:
[
  {
    "description": "string",
    "quantity": "string|number",
    "unit": "string",      -- pcs, kg, etc.
    "unitPrice": "string|number",
    "vatRate": "string|number",
    "netAmount": "string|number",
    "vatAmount": "string|number",
    "sortOrder": 0
  }
]

totals:
{
  "totalNet": "string|number",
  "totalVat": "string|number",
  "totalGross": "string|number"
}
*/


-- -----------------------------------------------------------------------------
-- 4. Column recommendations summary
-- -----------------------------------------------------------------------------
-- doc_type:   varchar(30)  - invoice | credit_note | correction | simplified
-- status:     varchar(20)  - draft | issued | cancelled
-- series:     varchar(20)  - INV, CN, etc.; allows multiple series per team
-- number:     integer      - NULL for drafts; 1..9999999999 when issued; from invoice_sequences
-- dates:      date         - issue_date required; supply_date optional
-- currency:   char(3)      - ISO 4217; EUR default (BG 2026+)
-- fx_rate:    numeric(15,6) - rate to EUR for VAT reporting; 1.0 if EUR
-- *_snapshot: jsonb        - frozen party data at issue time
-- items:      jsonb        - line items array
-- totals:     jsonb        - aggregated amounts


-- -----------------------------------------------------------------------------
-- 5. Tradeoffs
-- -----------------------------------------------------------------------------
-- JSONB snapshots vs normalised tables:
--   + Pros: Immutable audit trail; schema changes don't affect old invoices;
--           single read for full doc; flexible for future BG e-invoicing formats.
--   - Cons: Harder to query/report across invoices (e.g. sum by recipient);
--           validation only in app layer.
--
-- invoice_sequences vs MAX(number)+1:
--   + Pros: No race conditions; explicit lock per series; supports multiple series.
--   - Cons: Extra table and update on each issue.
--
-- Partial unique index (team_id, series, number) WHERE number IS NOT NULL:
--   + Pros: Drafts can exist without numbers; only finalized docs enforce uniqueness.
--   - Cons: Slightly more complex than full unique; number must be NOT NULL on issue.
--
-- referenced_invoice_id nullable:
--   + Pros: Credit notes / corrections link to original; SET NULL on delete preserves orphans.
--   - Cons: No FK from invoices back to credit notes (one-to-many); acceptable.
--
-- fx_rate and currency:
--   + Pros: NRA requires VAT in EUR; fx_rate stores rate at issue_date for audit.
--   - Cons: Must be kept in sync with issue_date; app responsibility.

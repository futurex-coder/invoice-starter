# Applying Migrations to Supabase

This repo uses **Drizzle Kit** for migrations. Migrations are stored in `lib/db/migrations/`.

**Env var:** Drizzle uses **`POSTGRES_URL`** (not `DATABASE_URL`). Set it in `.env` for both local runs and Supabase.

## Environment

Set `POSTGRES_URL` in your `.env` to your **Supabase connection string**:

- Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
- **Project Settings** → **Database**
- Under "Connection string", select **URI**
- Use the **Connection pooling** URI (port **6543** for transaction mode, or **5432** for session mode)
- Replace `[YOUR-PASSWORD]` with your database password

Example format:
```
POSTGRES_URL=postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
```

## Commands

### 1. Generate migrations (after schema changes)

When you modify `lib/db/schema.ts`, generate a new migration file:

```bash
pnpm db:generate
```

Output: a new SQL file in `lib/db/migrations/` (e.g. `0001_dear_diamondback.sql`).

### 2. Apply migrations to Supabase

Apply all pending migrations to the database:

```bash
pnpm db:migrate
```

This runs `drizzle-kit migrate`, which:
1. Reads migrations from `lib/db/migrations/`
2. Connects using `POSTGRES_URL` from `.env`
3. Executes any migrations not yet applied

**Equivalent direct CLI command:**
```bash
npx drizzle-kit migrate
```

## Current migrations

- `0000_soft_the_anarchist.sql` — initial schema (users, teams, etc.)
- `0001_dear_diamondback.sql` — adds `invoice_sequences` and `invoices` tables
- `0002_known_kabuki.sql` — adds `team_company_profiles`, `partners`, `articles`; adds invoice columns (`language`, `payment_method`, `payment_status`, `due_date`, `vat_mode`, `no_vat_reason`, `amount_in_words`) and index `idx_invoices_team_payment_status`
- `0003_gorgeous_skin.sql` — adds `customer_note`, `internal_comment` columns to invoices
- `0004_invoice_relational.sql` — adds `partner_id`, `supplier_profile_id` FK columns to `invoices`; creates `invoice_lines` table with `article_id` FK (hybrid relational + snapshot model)

## Verification

**Option A — Drizzle Studio**

```bash
pnpm db:studio
```

Opens Drizzle Studio. Confirm tables: `team_company_profiles`, `partners`, `articles`, and that `invoices` has the new columns.

**Option B — Supabase SQL Editor**

In Supabase Dashboard → **SQL Editor**, run:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('team_company_profiles', 'partners', 'articles', 'invoices')
ORDER BY table_name;
```

You should see all four rows. To confirm new invoice columns:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'invoices'
  AND column_name IN ('language', 'payment_method', 'payment_status', 'due_date', 'vat_mode', 'no_vat_reason', 'amount_in_words')
ORDER BY column_name;
```

All seven columns should appear.

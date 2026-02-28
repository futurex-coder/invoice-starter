# Applying Migrations to Supabase

This repo uses **Drizzle Kit** for migrations. Migrations are stored in `lib/db/migrations/`.

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

## Current migration (Bulgarian invoicing)

- `0000_soft_the_anarchist.sql` — initial schema
- `0001_dear_diamondback.sql` — adds `invoice_sequences` and `invoices` tables

## Verification

After applying:

```bash
pnpm db:studio
```

Opens Drizzle Studio to inspect tables. Ensure `invoice_sequences` and `invoices` exist.

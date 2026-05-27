# Database Migrations

This project uses [Drizzle Kit](https://orm.drizzle.team/kit-docs/overview)
to manage Postgres schema changes against Supabase.

## TL;DR commands

| Command | When to run |
|---|---|
| `npm run db:setup` | One-time, after cloning the repo or after this F2 lands on an existing DB. Detects state and does the right thing — fresh install, baseline existing, or apply pending. Idempotent. |
| `npm run db:generate` | After editing `lib/db/schema.ts`. Produces a new migration file under `lib/db/migrations/`. **Commit the generated file.** |
| `npm run db:migrate` | After pulling someone else's `db:generate` output, or to apply pending migrations against your DB. |
| `npm run db:seed` | Populate dev data. |
| `npm run db:studio` | Open Drizzle Studio (browse the DB). |

## The day-to-day workflow

1. Edit `lib/db/schema.ts` — add a column, change a type, add a table.
2. `npm run db:generate` — produces `lib/db/migrations/00XX_<auto-name>.sql`.
3. Inspect the generated SQL. Drizzle Kit is conservative but **always
   review** — it sometimes generates DROP statements when an
   easier-for-Postgres ALTER would do.
4. Commit the migration SQL **and** the updated `meta/_journal.json` /
   `meta/00XX_snapshot.json` together with the schema change. They are
   one atomic unit.
5. `npm run db:migrate` — applies the new migration to your DB.

When the next developer pulls your commit, they run `db:migrate` to
catch up.

## Baselining an existing database

If you're applying F2 to a Supabase project that **already has the
tables** (because the schema lived in `schema.ts` but no migration
files existed before), `npm run db:setup` will detect this and stamp
the journal **without** re-executing the SQL. Specifically:

- If `public.users` exists but `drizzle.__drizzle_migrations` does not,
  the script creates `drizzle.__drizzle_migrations` and inserts one
  row per migration in `lib/db/migrations/`, using Drizzle's own
  `readMigrationFiles` helper to compute hashes that exactly match
  what `drizzle-kit migrate` would write.

Run it **once** against each environment that has the existing schema
(dev DB, prod DB). After that, every environment uses the standard
`db:migrate` flow.

## State table — what `db:setup` does

| `public.users` | `drizzle.__drizzle_migrations` | Action |
|---|---|---|
| missing | missing | Apply all migrations (fresh install). |
| present | missing | Baseline the journal. No SQL executed. |
| present | present | Apply any pending migrations (no-op if up to date). |

## Supabase gotchas

- **`auth.*` schema** is owned by Supabase. We don't touch it. Drizzle
  only operates on `public.*` (the tables in `schema.ts`) and creates
  its journal in `drizzle.*`.
- **Storage extension** (`storage.objects`, `storage.buckets`) is also
  Supabase-managed. We talk to it through the Storage API
  (`lib/supabase/storage.ts`), never via SQL.
- **Connection pooling**: `POSTGRES_URL` should use the pooler URI
  (port 6543) for app traffic. Migrations go through the same URL and
  are short-lived enough that it doesn't matter.
- **RLS is currently OFF** for application tables. We authorize via
  session middleware (`requireUser`/`requireCompanyAccess` from
  `lib/auth/guards.ts`). RLS is tracked as a follow-up — when added,
  it'll be a separate set of migrations.

## Common pitfalls

- **Editing a committed migration**. Don't. Drizzle hashes the file
  content; editing it invalidates the journal on every environment
  that already applied it. If the migration is wrong, write a *new*
  migration that fixes it forward.
- **Running `drizzle-kit push`** (not in our scripts) — this syncs the
  schema directly without recording a migration. Only useful for
  rapid local experimentation; don't use it on shared DBs.
- **Renames look like drop+add to Drizzle**. When you rename a column,
  drizzle-kit will generate `DROP COLUMN` + `ADD COLUMN`, losing data.
  For renames, edit the generated SQL by hand to use `RENAME COLUMN`.
- **JSONB column shape changes** aren't visible to Drizzle (the column
  type is just `jsonb`). Changes to the TypeScript shape don't generate
  migrations. If you need to migrate data inside JSONB, write a hand
  migration with a SQL `UPDATE` statement.

## File layout

```
lib/db/
├── schema.ts           — source of truth, every table here
├── drizzle.ts          — runtime client (used by the app)
├── queries.ts          — typed query helpers
├── seed.ts             — dev data
├── setup.ts            — first-time / baselining script (see above)
└── migrations/
    ├── 0000_<name>.sql — generated SQL, never edit after commit
    ├── 0001_<name>.sql
    └── meta/
        ├── _journal.json       — list of generated migrations
        └── 0000_snapshot.json  — Drizzle's internal schema snapshot
```

The `meta/` directory is part of the migration — Drizzle uses it to
compute diffs for the next `db:generate` run.

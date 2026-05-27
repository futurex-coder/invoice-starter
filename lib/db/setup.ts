/**
 * Database setup script.
 *
 * Detects the DB state and does the right thing:
 *   - **Fresh DB** (no tables, no journal) → apply all migrations.
 *   - **Existing DB, no/empty journal** → baseline the journal without
 *     re-executing the SQL.
 *   - **Already initialized, journal matches** → apply any pending migrations.
 *   - **Journal has orphaned entries** (hashes that don't match any committed
 *     migration) → refuse and print instructions, unless `--reset-journal` is
 *     passed, in which case truncate + reseed.
 *
 * Idempotent. Safe to re-run.
 *
 * Usage:
 *   npm run db:setup
 *   npm run db:setup -- --reset-journal   (one-off: discard orphaned entries)
 *
 * For day-to-day "apply pending migrations after a schema change", use
 * `npm run db:migrate` directly.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres, { type Sql } from 'postgres';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_FOLDER = path.resolve(__dirname, 'migrations');
const RESET_FLAG = '--reset-journal';
const resetJournal = process.argv.includes(RESET_FLAG);

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

async function tableExists(
  sql: Sql,
  schema: string,
  table: string
): Promise<boolean> {
  const rows = await sql<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = ${schema}
        AND table_name = ${table}
    ) AS present
  `;
  return rows[0]?.present === true;
}

type JournalEntry = { hash: string; created_at: number | null };

async function readJournal(sql: Sql): Promise<JournalEntry[] | null> {
  const exists = await tableExists(sql, 'drizzle', '__drizzle_migrations');
  if (!exists) return null;
  return sql<JournalEntry[]>`
    SELECT hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY id
  `;
}

async function ensureJournalTable(sql: Sql): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
}

async function stampMigrations(sql: Sql): Promise<void> {
  // Use Drizzle's own readMigrationFiles so computed hashes are byte-exact
  // with what `drizzle-kit migrate` expects later.
  const migrations = readMigrationFiles({
    migrationsFolder: MIGRATIONS_FOLDER,
  });

  if (migrations.length === 0) {
    console.warn(
      '  No migration files found — nothing to stamp. (Did you run `npm run db:generate`?)'
    );
    return;
  }

  for (const m of migrations) {
    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${m.hash}, ${m.folderMillis})
    `;
    console.log(
      `  Stamped: hash=${m.hash.slice(0, 12)}… created_at=${m.folderMillis}`
    );
  }
}

async function main(): Promise<void> {
  const sql = postgres(process.env.POSTGRES_URL!, { prepare: false });
  const db = drizzle(sql);

  try {
    const [publicTablesExist, journal] = await Promise.all([
      // `users` is the oldest table; if it's missing the schema isn't applied.
      tableExists(sql, 'public', 'users'),
      readJournal(sql),
    ]);
    const journalRows = journal ?? [];

    // Compare what's in our migrations folder with what the journal records.
    const ourMigrations = readMigrationFiles({
      migrationsFolder: MIGRATIONS_FOLDER,
    });
    const ourHashes = new Set(ourMigrations.map((m) => m.hash));
    const journalHashes = new Set(journalRows.map((r) => r.hash));

    const orphanedInJournal = journalRows.filter(
      (r) => !ourHashes.has(r.hash)
    );
    const ourMissingFromJournal = ourMigrations.filter(
      (m) => !journalHashes.has(m.hash)
    );

    // Case 1: fresh database
    if (!publicTablesExist && journalRows.length === 0) {
      console.log('Fresh database detected — applying all migrations…');
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      console.log('✅ All migrations applied.');
      return;
    }

    // Case 2: existing tables, journal empty or missing — baseline
    if (publicTablesExist && journalRows.length === 0) {
      console.log(
        `Existing database detected — tables present, journal ${
          journal === null ? 'missing' : 'empty'
        }.`
      );
      console.log('  Baselining the journal without re-executing SQL…');
      await ensureJournalTable(sql);
      await stampMigrations(sql);
      console.log('✅ Journal baselined.');
      console.log(
        '   Going forward, use `npm run db:migrate` for new schema changes.'
      );
      return;
    }

    // Case 3: orphaned entries — refuse unless --reset-journal
    if (orphanedInJournal.length > 0) {
      if (!resetJournal) {
        console.error(
          `\n⚠️  Journal contains ${orphanedInJournal.length} entries that don't match any committed migration:`
        );
        for (const r of orphanedInJournal) {
          console.error(
            `     hash=${r.hash.slice(0, 16)}…  created_at=${r.created_at}`
          );
        }
        console.error(
          '\n  These are likely leftovers from a previous migration system whose SQL'
        );
        console.error(
          '  files no longer exist in lib/db/migrations/. To reconcile, re-run with:'
        );
        console.error(`\n      npm run db:setup -- ${RESET_FLAG}\n`);
        console.error(
          '  That will TRUNCATE drizzle.__drizzle_migrations and reseed it with the'
        );
        console.error(
          '  hashes from the current migrations/ folder. Your data in public.* is'
        );
        console.error('  not affected.');
        process.exit(1);
      }

      console.log(
        `Resetting journal — ${orphanedInJournal.length} orphaned entries will be removed.`
      );
      await sql`TRUNCATE drizzle.__drizzle_migrations RESTART IDENTITY`;
      await stampMigrations(sql);
      console.log('✅ Journal reset and reseeded.');
      console.log(
        '   Going forward, use `npm run db:migrate` for new schema changes.'
      );
      return;
    }

    // Case 4: journal is a subset of our migrations — apply the pending ones
    if (ourMissingFromJournal.length > 0) {
      console.log(
        `Journal up to ${journalRows.length} of ${ourMigrations.length} entries — applying ${ourMissingFromJournal.length} pending migration(s)…`
      );
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      console.log('✅ Done. All migrations are up to date.');
      return;
    }

    // Case 5: everything matches — no-op
    console.log(
      `Journal fully in sync (${journalRows.length} entries). Nothing to do.`
    );
  } finally {
    await sql.end();
  }
}

main().catch((err: unknown) => {
  console.error(
    '\n❌ Setup failed:',
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});

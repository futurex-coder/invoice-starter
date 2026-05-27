/**
 * Database setup script.
 *
 * Detects the DB state and does the right thing:
 *   - **Fresh DB** (no tables, no journal) → apply all migrations.
 *   - **Existing DB, no journal** (the situation when a project that didn't
 *     have committed migrations adds them later) → baseline the journal
 *     without re-executing the SQL.
 *   - **Already initialized** (journal exists) → apply any pending migrations.
 *
 * Idempotent. Safe to re-run.
 *
 * Usage:
 *   POSTGRES_URL=... npm run db:setup
 *
 * For day-to-day "apply pending migrations after a schema change", use
 * `npm run db:migrate` directly — this script delegates to the same
 * mechanism in the already-initialized branch.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres, { type Sql } from 'postgres';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const MIGRATIONS_FOLDER = path.resolve(__dirname, 'migrations');

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

async function baselineJournal(sql: Sql): Promise<void> {
  // Drizzle's journal lives in its own schema. Create both if missing.
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  // Use Drizzle's own readMigrationFiles so the computed hashes are
  // byte-exact with what `drizzle-kit migrate` will expect later.
  const migrations = readMigrationFiles({
    migrationsFolder: MIGRATIONS_FOLDER,
  });

  if (migrations.length === 0) {
    console.warn(
      '  No migration files found — nothing to baseline. (Did you run `npm run db:generate`?)'
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
    const [publicTablesExist, journalExists] = await Promise.all([
      // `users` is the oldest table; if it's missing the schema isn't applied.
      tableExists(sql, 'public', 'users'),
      tableExists(sql, 'drizzle', '__drizzle_migrations'),
    ]);

    if (!publicTablesExist && !journalExists) {
      console.log('Fresh database detected — applying all migrations…');
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
      console.log('✅ All migrations applied.');
      return;
    }

    if (publicTablesExist && !journalExists) {
      console.log(
        'Existing database detected (tables present, journal empty) —'
      );
      console.log('  baselining the journal without re-executing SQL…');
      await baselineJournal(sql);
      console.log('✅ Journal baselined.');
      console.log(
        '   Going forward, use `npm run db:migrate` for new schema changes.'
      );
      return;
    }

    console.log(
      'Journal already exists — applying any pending migrations…'
    );
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log('✅ Done. All migrations are up to date.');
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

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const rawPostgresUrl = process.env.POSTGRES_URL;
if (!rawPostgresUrl) {
  throw new Error('POSTGRES_URL environment variable is not set');
}
const POSTGRES_URL: string = rawPostgresUrl;

// In `next dev`, every recompile re-evaluates this module — a bare
// module-level pool leaks 10 connections per rebuild until the Supabase
// pooler hits its cap (seen live: EMAXCONN at 200). Cache the pool on
// globalThis outside production so rebuilds reuse it.
declare global {
  var __invoiclyPgPool: ReturnType<typeof postgres> | undefined;
}

function createPool() {
  return postgres(POSTGRES_URL, {
    prepare: false,
    // Cap connections per Next.js process instance. Conservative against
    // Supabase's pooler default (~60 total). Tune up if dashboards show
    // sustained connection-saturation under load.
    max: 10,
  });
}

export const client = globalThis.__invoiclyPgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') {
  globalThis.__invoiclyPgPool = client;
}

export const db = drizzle(client, { schema });

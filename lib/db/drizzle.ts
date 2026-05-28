import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL environment variable is not set');
}

export const client = postgres(process.env.POSTGRES_URL, {
  prepare: false,
  // Cap connections per Next.js process instance. Conservative against
  // Supabase's pooler default (~60 total). Tune up if dashboards show
  // sustained connection-saturation under load.
  max: 10,
});
export const db = drizzle(client, { schema });

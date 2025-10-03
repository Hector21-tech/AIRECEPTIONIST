import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

// Allow build to succeed without DB connection
// The actual DB will be used at runtime
let client: postgres.Sql;
let db: ReturnType<typeof drizzle>;

if (process.env.POSTGRES_URL) {
  client = postgres(process.env.POSTGRES_URL);
  db = drizzle(client, { schema });
} else if (process.env.NODE_ENV === 'production') {
  // In production build phase, we need dummy exports
  console.warn('⚠️  POSTGRES_URL not set - using dummy connection for build');
  client = null as any;
  db = null as any;
} else {
  throw new Error('POSTGRES_URL environment variable is not set');
}

export { client, db };

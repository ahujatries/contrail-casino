/**
 * Apply Drizzle migrations using postgres.js directly.
 * Avoids drizzle-kit's interactive push prompts in CI/scripts.
 *
 *   pnpm --filter @airport-pong/db migrate
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL_DIRECT or DATABASE_URL is required');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, '../drizzle');

console.log('Connecting to Postgres...');
const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql);

console.log('Running migrations from', migrationsFolder);
await migrate(db, { migrationsFolder });
console.log('Migrations applied');

await sql.end();
process.exit(0);

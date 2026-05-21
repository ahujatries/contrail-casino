import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

let _pool: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDb = () => {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  _pool = postgres(url, {
    max: 10,
    idle_timeout: 20,
    prepare: false, // Neon pooled doesn't support prepared statements
  });
  _db = drizzle(_pool, { schema });
  return _db;
};

// Direct (unpooled) connection — for LISTEN/NOTIFY and long-lived connections.
let _directPool: ReturnType<typeof postgres> | null = null;
export const getDirectClient = () => {
  if (_directPool) return _directPool;
  const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_DIRECT is required for LISTEN/NOTIFY');
  _directPool = postgres(url, {
    max: 1,
    idle_timeout: 0,
    max_lifetime: null,
    prepare: false,
  });
  return _directPool;
};

import 'server-only';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getDb, users, type User } from '@airport-pong/db';
import { STARTING_BALANCE } from '@airport-pong/shared';
import { generateCallsign } from './callsigns';

export const COOKIE_NAME = 'ap_uid';

/**
 * Gets or creates the user identified by the `ap_uid` cookie. Middleware
 * issues the cookie before any RSC/route handler runs so this is always
 * available; we still defensively no-op if it's missing.
 */
export async function getCurrentUser(): Promise<User | null> {
  const c = await cookies();
  const uid = c.get(COOKIE_NAME)?.value;
  if (!uid) return null;
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  if (rows[0]) return rows[0];

  // First sighting — create the row. Retry on (extremely rare) callsign collision.
  for (let i = 0; i < 5; i++) {
    const callsign = generateCallsign();
    try {
      const [u] = await db
        .insert(users)
        .values({ id: uid, callsign, balance: STARTING_BALANCE })
        .returning();
      return u;
    } catch (err) {
      // unique violation on callsign — try again
      if (i === 4) throw err;
    }
  }
  return null;
}

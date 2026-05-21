/**
 * Quick connectivity probe — verifies env vars + OpenSky auth + Neon DB
 * without starting the full polling loop. Useful for setup sanity check.
 *
 *   pnpm --filter worker probe
 */
import { sql } from 'drizzle-orm';
import { getDb } from '@airport-pong/db';
import { describeAuth, fetchStatesInBbox } from './opensky.ts';
import { GLOBAL_BBOX } from '@airport-pong/shared';
import { log } from './logger.ts';

async function main() {
  log.info('probe start', { auth: describeAuth() });

  log.info('checking DB...');
  const db = getDb();
  const r = await db.execute(sql`SELECT version() as v`);
  log.info('db ok', { row: (r as unknown as Array<{ v: string }>)[0] });

  log.info('checking OpenSky...', { bbox: GLOBAL_BBOX });
  const resp = await fetchStatesInBbox();
  log.info('opensky ok', { time: resp.time, states: resp.states.length });

  // Print first 5 states as a sanity check
  for (const s of resp.states.slice(0, 5)) {
    log.info('sample state', {
      icao24: s.icao24,
      cs: s.callsign,
      lat: s.latitude,
      lng: s.longitude,
      onGround: s.onGround,
      altM: s.baroAltitudeM,
    });
  }

  log.info('probe done');
  process.exit(0);
}

main().catch((err) => {
  log.error('probe failed', { error: String(err), stack: (err as Error)?.stack });
  process.exit(1);
});

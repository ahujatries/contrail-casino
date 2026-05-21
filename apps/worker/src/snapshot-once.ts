/**
 * One-shot: fetch OpenSky states and write a live_aircraft snapshot.
 * Useful for testing the /tracker UI without starting the polling loop
 * (which would race with the Railway worker for event writes).
 *
 *   pnpm --filter worker exec tsx --env-file=../../.env.local src/snapshot-once.ts
 */
import { fetchStatesInBbox } from './opensky.ts';
import { aircraftDb } from './aircraft-db.ts';
import { writeLiveSnapshot } from './live-snapshot.ts';
import { log } from './logger.ts';

async function main() {
  await aircraftDb.init();
  log.info('aircraft db ready', { cached: aircraftDb.size() });
  const resp = await fetchStatesInBbox();
  log.info('fetched', { states: resp.states.length });
  const wrote = await writeLiveSnapshot(resp.states, new Date(resp.time * 1000));
  log.info('snapshot written', { wrote });
  process.exit(0);
}

main().catch((err) => {
  log.error('snapshot-once failed', { error: String(err), stack: (err as Error)?.stack });
  process.exit(1);
});

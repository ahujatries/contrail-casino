import { sql } from 'drizzle-orm';
import { events as eventsTable, getDb } from '@airport-pong/db';
import { describeAuth, fetchStatesInBbox } from './opensky.ts';
import { EventDetector } from './detector.ts';
import { aircraftDb } from './aircraft-db.ts';
import { RaceResolver } from './resolver.ts';
import { writeLiveSnapshot } from './live-snapshot.ts';
import { resolveOnEvent } from './bet-resolver.ts';
import { isHeavyTypecode } from '@airport-pong/shared';
import { log } from './logger.ts';
import { health, startHealthServer } from './healthz.ts';

// 30s default keeps us at ~2880 calls/day, safely under OpenSky's ~4000/day
// authenticated free-tier limit. Override via WORKER_POLL_INTERVAL_MS env.
const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 30_000);
health.setPollIntervalMs(POLL_INTERVAL_MS);

// 429 backoff state — exponential, capped at 30 minutes.
// Reduced ceiling since we now auto-rotate to another client on 429.
let backoffMultiplier = 1;
const MAX_BACKOFF_MULT = 20;
const resetBackoff = () => {
  backoffMultiplier = 1;
  health.setBackoffMultiplier(1);
};
const grow429Backoff = () => {
  backoffMultiplier = Math.min(MAX_BACKOFF_MULT, Math.max(2, backoffMultiplier * 2));
  health.setBackoffMultiplier(backoffMultiplier);
};
const currentInterval = () => POLL_INTERVAL_MS * backoffMultiplier;

async function tick(detector: EventDetector) {
  health.recordTickStart();
  const startMs = Date.now();
  let resp;
  try {
    resp = await fetchStatesInBbox();
    resetBackoff();
  } catch (err) {
    const msg = String(err);
    health.recordTickFailure(msg);
    if (msg.includes('429')) {
      grow429Backoff();
      log.warn('opensky 429 — all clients rate-limited, backing off', {
        nextIntervalMs: currentInterval(),
        nextIntervalSec: Math.round(currentInterval() / 1000),
      });
    } else {
      log.error('opensky fetch failed', { error: msg });
    }
    return;
  }
  const fetchMs = Date.now() - startMs;

  const detected = detector.process(resp.states, resp.time);

  if (detected.length > 0) {
    const db = getDb();
    const rows = detected.map((d) => {
      const typecode = aircraftDb.typecodeFor(d.icao24);
      return {
        airport: d.airport,
        eventType: d.eventType,
        icao24: d.icao24,
        callsign: d.callsign,
        typecode,
        isHeavy: isHeavyTypecode(typecode),
        altitudeFt: d.altitudeFt,
        occurredAt: d.occurredAt,
      };
    });
    const inserted = await db.insert(eventsTable).values(rows).returning({ id: eventsTable.id });

    // Postgres NOTIFY for downstream SSE consumers. Payload kept tiny (8KB limit).
    for (let i = 0; i < inserted.length; i++) {
      const row = rows[i];
      const id = inserted[i].id;
      const payload = JSON.stringify({
        type: 'event',
        id,
        airport: row.airport,
        eventType: row.eventType,
        isHeavy: row.isHeavy,
        callsign: row.callsign,
        typecode: row.typecode,
        occurredAt: row.occurredAt.toISOString(),
      });
      await db.execute(sql`SELECT pg_notify('airport_pong_events', ${payload})`);

      log.event(`${row.eventType.toUpperCase()} ${row.airport}`, {
        cs: row.callsign,
        tc: row.typecode,
        ft: row.altitudeFt,
        heavy: row.isHeavy,
      });

      try {
        await resolveOnEvent({
          airport: row.airport,
          eventType: row.eventType,
          isHeavy: row.isHeavy,
          icao24: row.icao24,
        });
      } catch (err) {
        log.error('bet resolve on event failed', { error: String(err) });
      }
    }
  }

  // Live snapshot: written every tick so /tracker has fresh positions.
  let liveCount = 0;
  try {
    liveCount = await writeLiveSnapshot(resp.states, new Date(resp.time * 1000));
  } catch (err) {
    log.error('live snapshot failed', { error: String(err) });
  }

  health.recordTickSuccess(detected.length);

  log.info('tick', {
    states: resp.states.length,
    detected: detected.length,
    live: liveCount,
    cacheSize: detector.cacheSize(),
    fetchMs,
  });
}

async function main() {
  log.info('worker starting', {
    auth: describeAuth(),
    pollIntervalMs: POLL_INTERVAL_MS,
  });

  // Health endpoint for Railway + UptimeRobot
  startHealthServer();

  // Ensure DB connection works before we start polling
  const db = getDb();
  await db.execute(sql`SELECT 1`);
  log.info('db connection ok');

  await aircraftDb.init();
  log.info('aircraft db ready', { cached: aircraftDb.size() });

  const detector = new EventDetector();
  const resolver = new RaceResolver();
  resolver.start();

  // Initial seed pass: populate cache without firing events (no prev state yet means nothing fires anyway)
  await tick(detector);

  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    log.info('shutdown requested');
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  // Schedule ticks (allow drift; back off naturally if a tick overruns)
  while (!stopping) {
    const tickStart = Date.now();
    try {
      await tick(detector);
    } catch (err) {
      log.error('tick threw', { error: String(err) });
    }
    const elapsed = Date.now() - tickStart;
    const wait = Math.max(0, currentInterval() - elapsed);
    await new Promise((r) => setTimeout(r, wait));
  }
}

main().catch((err) => {
  log.error('fatal', { error: String(err), stack: (err as Error)?.stack });
  process.exit(1);
});

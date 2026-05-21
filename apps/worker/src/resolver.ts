import { and, gte, lt } from 'drizzle-orm';
import {
  AIRPORT_CODES,
  RACE_TYPES,
  getCurrentHourStart,
  getFeatureMatchup,
  winnerOf,
  type AirportCode,
  type AirportScores,
  type RaceType,
} from '@airport-pong/shared';
import { events as eventsTable, races as racesTable, getDb } from '@airport-pong/db';
import { resolveOnRace } from './bet-resolver.ts';
import { log } from './logger.ts';

/**
 * Persists one race row per (race_type, hour, featured_pair) for archive/history.
 * Live scores are always derived directly from `events`; this is just the
 * post-hoc record so the /history view has something to show.
 *
 * Resolves the *previous* hour at the top of every hour.
 */
export class RaceResolver {
  private lastResolvedHourMs = -1;
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    // Seed with the current hour so we don't immediately resolve a partial one
    this.lastResolvedHourMs = getCurrentHourStart().getTime();
    this.checkInterval = setInterval(() => this.tick().catch((err) => {
      log.error('[resolver] tick failed', { error: String(err) });
    }), 60_000);
    log.info('[resolver] started', {
      seedHour: new Date(this.lastResolvedHourMs).toISOString(),
    });
  }

  stop() {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }

  private async tick() {
    const currentHourStart = getCurrentHourStart();
    if (currentHourStart.getTime() === this.lastResolvedHourMs) return;

    // Hour just rolled over — resolve every hour we missed (usually just one)
    const previousHourStart = new Date(this.lastResolvedHourMs);
    const previousHourEnd = currentHourStart;
    await this.resolveHour(previousHourStart, previousHourEnd);
    this.lastResolvedHourMs = currentHourStart.getTime();
  }

  /**
   * Manually resolve a given hour window — useful for backfilling on first run.
   */
  async resolveHour(hourStart: Date, hourEnd: Date) {
    const db = getDb();
    const rows = await db
      .select()
      .from(eventsTable)
      .where(and(gte(eventsTable.occurredAt, hourStart), lt(eventsTable.occurredAt, hourEnd)));

    if (rows.length === 0) {
      log.info('[resolver] no events in hour, skipping', { hourStart: hourStart.toISOString() });
      return;
    }

    const scoresByRace: Record<RaceType, AirportScores> = {
      takeoff: { JFK: 0, ORD: 0, ATL: 0, LAX: 0 },
      heavy: { JFK: 0, ORD: 0, ATL: 0, LAX: 0 },
      total_ops: { JFK: 0, ORD: 0, ATL: 0, LAX: 0 },
    };
    for (const e of rows) {
      const a = e.airport as AirportCode;
      if (!AIRPORT_CODES.includes(a)) continue;
      if (e.eventType === 'takeoff') scoresByRace.takeoff[a] += 1;
      if (e.isHeavy) scoresByRace.heavy[a] += 1;
      scoresByRace.total_ops[a] += 1;
    }

    // Use the matchup as of the *resolving* hour's midpoint so it's stable
    const sampleTime = new Date(hourStart.getTime() + 30 * 60 * 1000);
    const [airportA, airportB] = getFeatureMatchup(sampleTime);

    const inserts = RACE_TYPES.map((raceType) => {
      const pairScores: AirportScores = {
        JFK: 0,
        ORD: 0,
        ATL: 0,
        LAX: 0,
      };
      pairScores[airportA] = scoresByRace[raceType][airportA];
      pairScores[airportB] = scoresByRace[raceType][airportB];
      const winner = winnerOf(pairScores, [airportA, airportB]);
      return {
        raceType,
        hourStart,
        hourEnd,
        airportA,
        airportB,
        scoreA: scoresByRace[raceType][airportA],
        scoreB: scoresByRace[raceType][airportB],
        winner: winner,
        resolvedAt: new Date(),
      };
    });

    await db.insert(racesTable).values(inserts);
    for (const r of inserts) {
      log.info('[resolver] resolved race', {
        type: r.raceType,
        hour: r.hourStart.toISOString().slice(0, 13),
        a: r.airportA,
        b: r.airportB,
        scoreA: r.scoreA,
        scoreB: r.scoreB,
        winner: r.winner,
      });
    }

    // Settle bets on every race type using full 4-airport scores
    for (const raceType of RACE_TYPES) {
      try {
        await resolveOnRace(raceType, hourStart, scoresByRace[raceType]);
      } catch (err) {
        log.error('[resolver] bet resolve on race failed', {
          raceType,
          error: String(err),
        });
      }
    }
  }
}

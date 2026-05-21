import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import {
  AIRPORT_CENTERS,
  AIRPORT_CODES,
  angleDiffDeg,
  bearingDeg,
  emptyAllScores,
  etaMinutes,
  getCurrentHourStart,
  getNextHourStart,
  getTodayStartUTC,
  haversineNm,
  type AirportCode,
  type AllScores,
} from '@airport-pong/shared';
import {
  bets as betsTable,
  events as eventsTable,
  liveAircraft,
  users as usersTable,
} from './schema';
import { getDb } from './client';

type ScoreRow = {
  airport: string;
  takeoff: number;
  heavy: number;
  total: number;
};

/**
 * Current hour's per-airport scores for all 3 race types.
 * Derives directly from the events table — no race row needed mid-hour.
 */
export const getCurrentHourScores = async (now: Date = new Date()): Promise<AllScores> => {
  const hourStart = getCurrentHourStart(now);
  const hourEnd = getNextHourStart(now);
  const db = getDb();

  const rows = (await db
    .select({
      airport: eventsTable.airport,
      takeoff: sql<number>`count(*) filter (where ${eventsTable.eventType} = 'takeoff')::int`,
      heavy: sql<number>`count(*) filter (where ${eventsTable.isHeavy} = true)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(and(gte(eventsTable.occurredAt, hourStart), lt(eventsTable.occurredAt, hourEnd)))
    .groupBy(eventsTable.airport)) as ScoreRow[];

  const scores = emptyAllScores();
  for (const r of rows) {
    const c = r.airport as AirportCode;
    if (!AIRPORT_CODES.includes(c)) continue;
    scores.takeoff[c] = r.takeoff;
    scores.heavy[c] = r.heavy;
    scores.total_ops[c] = r.total;
  }
  return scores;
};

/** Per-airport totals since midnight UTC — for the persistent "today" stats. */
export const getTodayTotals = async (now: Date = new Date()) => {
  const dayStart = getTodayStartUTC(now);
  const db = getDb();
  const rows = (await db
    .select({
      airport: eventsTable.airport,
      takeoff: sql<number>`count(*) filter (where ${eventsTable.eventType} = 'takeoff')::int`,
      landing: sql<number>`count(*) filter (where ${eventsTable.eventType} = 'landing')::int`,
      heavy: sql<number>`count(*) filter (where ${eventsTable.isHeavy} = true)::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(gte(eventsTable.occurredAt, dayStart))
    .groupBy(eventsTable.airport)) as Array<{
    airport: string;
    takeoff: number;
    landing: number;
    heavy: number;
    total: number;
  }>;

  const out: Record<
    AirportCode,
    { takeoff: number; landing: number; heavy: number; total: number }
  > = {
    JFK: { takeoff: 0, landing: 0, heavy: 0, total: 0 },
    ORD: { takeoff: 0, landing: 0, heavy: 0, total: 0 },
    ATL: { takeoff: 0, landing: 0, heavy: 0, total: 0 },
    LAX: { takeoff: 0, landing: 0, heavy: 0, total: 0 },
  };
  for (const r of rows) {
    const c = r.airport as AirportCode;
    if (!AIRPORT_CODES.includes(c)) continue;
    out[c] = { takeoff: r.takeoff, landing: r.landing, heavy: r.heavy, total: r.total };
  }
  return out;
};

export type RecentEvent = {
  id: number;
  airport: string;
  eventType: 'takeoff' | 'landing';
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  occurredAt: Date;
};

export type LiveAircraftRow = {
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  nearestAirport: string | null;
  latitude: number | null;
  longitude: number | null;
  altitudeFt: number | null;
  velocityKt: number | null;
  headingDeg: number | null;
  verticalRateFpm: number | null;
  onGround: boolean;
  updatedAt: Date;
};

export const getLiveAircraft = async (): Promise<LiveAircraftRow[]> => {
  const db = getDb();
  return db.select().from(liveAircraft);
};

export const getRecentEvents = async (limit: number = 25): Promise<RecentEvent[]> => {
  const db = getDb();
  const rows = await db
    .select({
      id: eventsTable.id,
      airport: eventsTable.airport,
      eventType: eventsTable.eventType,
      callsign: eventsTable.callsign,
      typecode: eventsTable.typecode,
      isHeavy: eventsTable.isHeavy,
      occurredAt: eventsTable.occurredAt,
    })
    .from(eventsTable)
    .orderBy(desc(eventsTable.occurredAt))
    .limit(limit);
  return rows;
};

/**
 * Rolling per-airport event pace (events per hour) over the last `windowMinutes`.
 * Drives odds calculations for both quick bets and race winner projections.
 */
export const getPaceByAirport = async (
  windowMinutes: number = 30,
  filter: 'all' | 'takeoff' | 'heavy' = 'all'
): Promise<Record<AirportCode, number>> => {
  const db = getDb();
  const since = new Date(Date.now() - windowMinutes * 60_000);

  const conds = [gte(eventsTable.occurredAt, since)];
  if (filter === 'takeoff') conds.push(eq(eventsTable.eventType, 'takeoff'));
  if (filter === 'heavy') conds.push(eq(eventsTable.isHeavy, true));

  const rows = (await db
    .select({
      airport: eventsTable.airport,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(and(...conds))
    .groupBy(eventsTable.airport)) as Array<{ airport: string; count: number }>;

  const out: Record<AirportCode, number> = { JFK: 0, ORD: 0, ATL: 0, LAX: 0 };
  for (const r of rows) {
    const c = r.airport as AirportCode;
    if (AIRPORT_CODES.includes(c)) out[c] = (r.count * 60) / windowMinutes;
  }
  return out;
};

export type ActiveBetRow = typeof betsTable.$inferSelect;

export const getActiveBetsForUser = async (userId: string): Promise<ActiveBetRow[]> => {
  const db = getDb();
  return db
    .select()
    .from(betsTable)
    .where(and(eq(betsTable.userId, userId), eq(betsTable.status, 'open')))
    .orderBy(desc(betsTable.placedAt));
};

export const getRecentBetsForUser = async (
  userId: string,
  limit: number = 50
): Promise<ActiveBetRow[]> => {
  const db = getDb();
  return db
    .select()
    .from(betsTable)
    .where(eq(betsTable.userId, userId))
    .orderBy(desc(betsTable.placedAt))
    .limit(limit);
};

export type LeaderboardRow = {
  callsign: string;
  balance: number;
};

export type LandingRaceContestant = {
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  velocityKt: number | null;
  headingDeg: number | null;
  etaMin: number;
  expectedLandingAt: string;
  distanceNm: number;
};

export type LandingRace = {
  pairId: string;
  airport: AirportCode;
  left: LandingRaceContestant;
  right: LandingRaceContestant;
  deltaSec: number;
};

export type CrossAirportRace = {
  pairId: string;
  leftAirport: AirportCode;
  rightAirport: AirportCode;
  left: LandingRaceContestant;
  right: LandingRaceContestant;
  deltaSec: number;
};

export type TakeoffRaceContestant = {
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  velocityKt: number;
  headingDeg: number | null;
};

export type TakeoffRace = {
  pairId: string;
  airport: AirportCode;
  left: TakeoffRaceContestant;
  right: TakeoffRaceContestant;
};

export type HeavyRacePair = {
  pairId: string;
  leftAirport: AirportCode;
  rightAirport: AirportCode;
};

const APPROACH_MAX_ALT_FT = 18_000;
const APPROACH_MAX_DIST_NM = 60;
const APPROACH_MIN_SPEED_KT = 120;
const APPROACH_MAX_BEARING_DELTA = 65;
const ETA_PAIR_WINDOW_SEC = 60;

const stablePairId = (a: string, b: string) => {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `${lo}-${hi}`;
};

export const getLandingRacesForAirport = async (
  airport: AirportCode
): Promise<LandingRace[]> => {
  const db = getDb();
  const center = AIRPORT_CENTERS[airport];
  const rows = await db
    .select()
    .from(liveAircraft)
    .where(and(eq(liveAircraft.nearestAirport, airport), eq(liveAircraft.onGround, false)));

  type Cand = LandingRaceContestant & { sortEta: number };
  const candidates: Cand[] = [];
  const now = Date.now();
  for (const r of rows) {
    if (
      r.latitude == null ||
      r.longitude == null ||
      r.velocityKt == null ||
      r.headingDeg == null
    )
      continue;
    if (r.altitudeFt != null && r.altitudeFt > APPROACH_MAX_ALT_FT) continue;
    if (r.velocityKt < APPROACH_MIN_SPEED_KT) continue;
    const dist = haversineNm(r.latitude, r.longitude, center.lat, center.lng);
    if (dist > APPROACH_MAX_DIST_NM) continue;
    const bearingToField = bearingDeg(r.latitude, r.longitude, center.lat, center.lng);
    const deltaHeading = Math.abs(angleDiffDeg(r.headingDeg, bearingToField));
    if (deltaHeading > APPROACH_MAX_BEARING_DELTA) continue;
    const eta = etaMinutes(r.latitude, r.longitude, center.lat, center.lng, r.velocityKt);
    if (eta == null || eta <= 0.5 || eta > 30) continue;
    candidates.push({
      icao24: r.icao24,
      callsign: r.callsign,
      typecode: r.typecode,
      isHeavy: r.isHeavy,
      latitude: r.latitude,
      longitude: r.longitude,
      altitudeFt: r.altitudeFt,
      velocityKt: r.velocityKt,
      headingDeg: r.headingDeg,
      etaMin: eta,
      expectedLandingAt: new Date(now + eta * 60_000).toISOString(),
      distanceNm: dist,
      sortEta: eta,
    });
  }

  candidates.sort((a, b) => a.sortEta - b.sortEta);

  // Pair adjacent candidates whose ETAs are within ETA_PAIR_WINDOW_SEC of each other.
  const pairs: LandingRace[] = [];
  const used = new Set<string>();
  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    if (used.has(a.icao24)) continue;
    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      if (used.has(b.icao24)) continue;
      const deltaSec = Math.abs(a.sortEta - b.sortEta) * 60;
      if (deltaSec > ETA_PAIR_WINDOW_SEC) break; // sorted, so no later candidate is closer
      pairs.push({
        pairId: stablePairId(a.icao24, b.icao24),
        airport,
        left: stripSortKey(a),
        right: stripSortKey(b),
        deltaSec,
      });
      used.add(a.icao24);
      used.add(b.icao24);
      break;
    }
  }
  return pairs;
};

const stripSortKey = (c: { sortEta: number } & LandingRaceContestant): LandingRaceContestant => {
  const { sortEta: _, ...rest } = c;
  void _;
  return rest;
};

/** Internal: build approach candidates for a given airport (same shape as Landing Race). */
const approachCandidatesForAirport = async (
  airport: AirportCode
): Promise<Array<LandingRaceContestant & { sortEta: number }>> => {
  const db = getDb();
  const center = AIRPORT_CENTERS[airport];
  const rows = await db
    .select()
    .from(liveAircraft)
    .where(and(eq(liveAircraft.nearestAirport, airport), eq(liveAircraft.onGround, false)));

  const out: Array<LandingRaceContestant & { sortEta: number }> = [];
  const now = Date.now();
  for (const r of rows) {
    if (
      r.latitude == null ||
      r.longitude == null ||
      r.velocityKt == null ||
      r.headingDeg == null
    )
      continue;
    if (r.altitudeFt != null && r.altitudeFt > APPROACH_MAX_ALT_FT) continue;
    if (r.velocityKt < APPROACH_MIN_SPEED_KT) continue;
    const dist = haversineNm(r.latitude, r.longitude, center.lat, center.lng);
    if (dist > APPROACH_MAX_DIST_NM) continue;
    const bearingToField = bearingDeg(r.latitude, r.longitude, center.lat, center.lng);
    const deltaHeading = Math.abs(angleDiffDeg(r.headingDeg, bearingToField));
    if (deltaHeading > APPROACH_MAX_BEARING_DELTA) continue;
    const eta = etaMinutes(r.latitude, r.longitude, center.lat, center.lng, r.velocityKt);
    if (eta == null || eta <= 0.5 || eta > 30) continue;
    out.push({
      icao24: r.icao24,
      callsign: r.callsign,
      typecode: r.typecode,
      isHeavy: r.isHeavy,
      latitude: r.latitude,
      longitude: r.longitude,
      altitudeFt: r.altitudeFt,
      velocityKt: r.velocityKt,
      headingDeg: r.headingDeg,
      etaMin: eta,
      expectedLandingAt: new Date(now + eta * 60_000).toISOString(),
      distanceNm: dist,
      sortEta: eta,
    });
  }
  out.sort((a, b) => a.sortEta - b.sortEta);
  return out;
};

/**
 * Cross-Airport Race: pair one aircraft from airport A and one from airport B
 * whose ETAs to their respective fields are within 60s of each other.
 */
export const getCrossAirportRaces = async (
  airportA: AirportCode,
  airportB: AirportCode
): Promise<CrossAirportRace[]> => {
  const [candsA, candsB] = await Promise.all([
    approachCandidatesForAirport(airportA),
    approachCandidatesForAirport(airportB),
  ]);
  const pairs: CrossAirportRace[] = [];
  const usedB = new Set<string>();
  for (const a of candsA) {
    let best: (typeof candsB)[number] | null = null;
    let bestDelta = ETA_PAIR_WINDOW_SEC;
    for (const b of candsB) {
      if (usedB.has(b.icao24)) continue;
      const delta = Math.abs(a.sortEta - b.sortEta) * 60;
      if (delta < bestDelta) {
        bestDelta = delta;
        best = b;
      }
    }
    if (best) {
      usedB.add(best.icao24);
      pairs.push({
        pairId: stablePairId(a.icao24, best.icao24),
        leftAirport: airportA,
        rightAirport: airportB,
        left: stripSortKey(a),
        right: stripSortKey(best),
        deltaSec: bestDelta,
      });
    }
  }
  return pairs;
};

/**
 * Takeoff Race: aircraft taxiing fast at the airport (likely close to runway).
 * Pair adjacent candidates by descending velocity so the "front of queue" gets
 * matched up first. Pair IDs are stable across polls via icao24 hash.
 */
const TAKEOFF_QUEUE_MIN_VELOCITY_KT = 15;
const TAKEOFF_QUEUE_MAX_VELOCITY_KT = 50; // anything faster is probably already rolling

export const getTakeoffRacesForAirport = async (
  airport: AirportCode
): Promise<TakeoffRace[]> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(liveAircraft)
    .where(and(eq(liveAircraft.nearestAirport, airport), eq(liveAircraft.onGround, true)));

  const queue: TakeoffRaceContestant[] = [];
  for (const r of rows) {
    if (r.velocityKt == null) continue;
    if (r.velocityKt < TAKEOFF_QUEUE_MIN_VELOCITY_KT) continue;
    if (r.velocityKt > TAKEOFF_QUEUE_MAX_VELOCITY_KT) continue;
    queue.push({
      icao24: r.icao24,
      callsign: r.callsign,
      typecode: r.typecode,
      isHeavy: r.isHeavy,
      velocityKt: r.velocityKt,
      headingDeg: r.headingDeg,
    });
  }
  // Sort by velocity descending (faster = closer to runway end)
  queue.sort((a, b) => b.velocityKt - a.velocityKt);
  const pairs: TakeoffRace[] = [];
  for (let i = 0; i + 1 < queue.length; i += 2) {
    pairs.push({
      pairId: stablePairId(queue[i].icao24, queue[i + 1].icao24),
      airport,
      left: queue[i],
      right: queue[i + 1],
    });
  }
  return pairs;
};

const ALL_AIRPORT_PAIRS: Array<[AirportCode, AirportCode]> = [
  ['JFK', 'ORD'],
  ['JFK', 'ATL'],
  ['JFK', 'LAX'],
  ['ORD', 'ATL'],
  ['ORD', 'LAX'],
  ['ATL', 'LAX'],
];

/** Heavy Race: always-available, no aircraft pairing — just airport pairs. */
export const listHeavyRacePairs = (): HeavyRacePair[] =>
  ALL_AIRPORT_PAIRS.map(([a, b]) => ({
    pairId: `${a}-${b}`,
    leftAirport: a,
    rightAirport: b,
  }));

export const getLeaderboard = async (limit: number = 100): Promise<LeaderboardRow[]> => {
  const db = getDb();
  return db
    .select({ callsign: usersTable.callsign, balance: usersTable.balance })
    .from(usersTable)
    .orderBy(desc(usersTable.balance))
    .limit(limit);
};

export type FeaturedFlight = {
  airport: AirportCode;
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  occurredAt: Date;
};

/**
 * Latest takeoff per airport in the last `windowMinutes` minutes — drives
 * the per-airport flight tracker card on the dashboard.
 */
export type FeaturedFlightLive = {
  airport: AirportCode;
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  latitude: number | null;
  longitude: number | null;
  altitudeFt: number | null;
  velocityKt: number | null;
  headingDeg: number | null;
  onGround: boolean;
  takeoffAt: string | null;
  updatedAt: string;
};

/**
 * Pick the aircraft to follow on a given airport's tracker card.
 *  - Preference 1: most recent takeoff at this airport in the last hour
 *    whose icao24 is still in live_aircraft and still airborne.
 *  - Fallback: highest-altitude airborne aircraft near this airport.
 * Returns null if nothing is in the air near the field.
 */
export const getFeaturedFlightForAirport = async (
  airport: AirportCode
): Promise<FeaturedFlightLive | null> => {
  const db = getDb();
  const since = new Date(Date.now() - 60 * 60 * 1000);

  const rows = await db
    .select({
      icao24: eventsTable.icao24,
      callsign: eventsTable.callsign,
      typecode: eventsTable.typecode,
      isHeavy: eventsTable.isHeavy,
      takeoffAt: eventsTable.occurredAt,
      latitude: liveAircraft.latitude,
      longitude: liveAircraft.longitude,
      altitudeFt: liveAircraft.altitudeFt,
      velocityKt: liveAircraft.velocityKt,
      headingDeg: liveAircraft.headingDeg,
      onGround: liveAircraft.onGround,
      updatedAt: liveAircraft.updatedAt,
    })
    .from(eventsTable)
    .innerJoin(liveAircraft, eq(eventsTable.icao24, liveAircraft.icao24))
    .where(
      and(
        eq(eventsTable.airport, airport),
        eq(eventsTable.eventType, 'takeoff'),
        gte(eventsTable.occurredAt, since),
        eq(liveAircraft.onGround, false)
      )
    )
    .orderBy(desc(eventsTable.occurredAt))
    .limit(1);

  if (rows[0]) {
    const r = rows[0];
    return {
      airport,
      icao24: r.icao24,
      callsign: r.callsign,
      typecode: r.typecode,
      isHeavy: r.isHeavy,
      latitude: r.latitude,
      longitude: r.longitude,
      altitudeFt: r.altitudeFt,
      velocityKt: r.velocityKt,
      headingDeg: r.headingDeg,
      onGround: r.onGround,
      takeoffAt: r.takeoffAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  const fallback = await db
    .select()
    .from(liveAircraft)
    .where(and(eq(liveAircraft.nearestAirport, airport), eq(liveAircraft.onGround, false)))
    .orderBy(desc(liveAircraft.altitudeFt))
    .limit(1);

  if (fallback[0]) {
    const r = fallback[0];
    return {
      airport,
      icao24: r.icao24,
      callsign: r.callsign,
      typecode: r.typecode,
      isHeavy: r.isHeavy,
      latitude: r.latitude,
      longitude: r.longitude,
      altitudeFt: r.altitudeFt,
      velocityKt: r.velocityKt,
      headingDeg: r.headingDeg,
      onGround: r.onGround,
      takeoffAt: null,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  return null;
};

export type DuelTakeoffFlight = {
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  velocityKt: number;
  headingDeg: number | null;
};

export type DuelLandingFlight = {
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  velocityKt: number;
  altitudeFt: number | null;
  headingDeg: number | null;
  etaMin: number;
  distanceNm: number;
  expectedLandingAt: string;
};

/**
 * "Next to depart" plane for the home page duel — the airport's highest-velocity
 * on-ground aircraft, which is almost certainly taxiing toward (or sitting at)
 * the runway threshold.
 */
export const getNextTakeoffForAirport = async (
  airport: AirportCode
): Promise<DuelTakeoffFlight | null> => {
  const db = getDb();
  const rows = await db
    .select()
    .from(liveAircraft)
    .where(
      and(
        eq(liveAircraft.nearestAirport, airport),
        eq(liveAircraft.onGround, true)
      )
    );

  let best: (typeof rows)[number] | null = null;
  for (const r of rows) {
    if (r.velocityKt == null) continue;
    if (r.velocityKt < 5 || r.velocityKt > 60) continue;
    if (!best || (r.velocityKt ?? 0) > (best.velocityKt ?? 0)) best = r;
  }
  if (!best) return null;
  return {
    icao24: best.icao24,
    callsign: best.callsign,
    typecode: best.typecode,
    isHeavy: best.isHeavy,
    velocityKt: best.velocityKt!,
    headingDeg: best.headingDeg,
  };
};

/**
 * "Next to land" plane — the lowest-ETA airborne aircraft approaching this
 * airport, using the same approach filter as the Landing Race candidate query.
 */
export const getNextLandingForAirport = async (
  airport: AirportCode
): Promise<DuelLandingFlight | null> => {
  const db = getDb();
  const center = AIRPORT_CENTERS[airport];
  const rows = await db
    .select()
    .from(liveAircraft)
    .where(
      and(
        eq(liveAircraft.nearestAirport, airport),
        eq(liveAircraft.onGround, false)
      )
    );

  let best: { row: (typeof rows)[number]; etaMin: number; dist: number } | null = null;
  for (const r of rows) {
    if (
      r.latitude == null ||
      r.longitude == null ||
      r.velocityKt == null ||
      r.headingDeg == null
    )
      continue;
    if (r.altitudeFt != null && r.altitudeFt > 18_000) continue;
    if (r.velocityKt < 120) continue;
    const dist = haversineNm(r.latitude, r.longitude, center.lat, center.lng);
    if (dist > 60) continue;
    const bear = bearingDeg(r.latitude, r.longitude, center.lat, center.lng);
    if (Math.abs(angleDiffDeg(r.headingDeg, bear)) > 65) continue;
    const eta = etaMinutes(r.latitude, r.longitude, center.lat, center.lng, r.velocityKt);
    if (eta == null || eta <= 0.5 || eta > 30) continue;
    if (!best || eta < best.etaMin) best = { row: r, etaMin: eta, dist };
  }
  if (!best) return null;
  const r = best.row;
  return {
    icao24: r.icao24,
    callsign: r.callsign,
    typecode: r.typecode,
    isHeavy: r.isHeavy,
    velocityKt: r.velocityKt!,
    altitudeFt: r.altitudeFt,
    headingDeg: r.headingDeg,
    etaMin: best.etaMin,
    distanceNm: best.dist,
    expectedLandingAt: new Date(Date.now() + best.etaMin * 60_000).toISOString(),
  };
};

export const getLatestTakeoffByAirport = async (
  windowMinutes: number = 30
): Promise<Record<AirportCode, FeaturedFlight | null>> => {
  const db = getDb();
  const since = new Date(Date.now() - windowMinutes * 60_000);
  // DISTINCT ON pattern via subquery + window function — keep portable
  const rows = (await db
    .select({
      airport: eventsTable.airport,
      icao24: eventsTable.icao24,
      callsign: eventsTable.callsign,
      typecode: eventsTable.typecode,
      isHeavy: eventsTable.isHeavy,
      occurredAt: eventsTable.occurredAt,
      rn: sql<number>`row_number() over (partition by ${eventsTable.airport} order by ${eventsTable.occurredAt} desc)`,
    })
    .from(eventsTable)
    .where(
      and(
        gte(eventsTable.occurredAt, since),
        eq(eventsTable.eventType, 'takeoff')
      )
    )) as Array<{
    airport: string;
    icao24: string;
    callsign: string | null;
    typecode: string | null;
    isHeavy: boolean;
    occurredAt: Date;
    rn: number;
  }>;

  const out: Record<AirportCode, FeaturedFlight | null> = {
    JFK: null,
    ORD: null,
    ATL: null,
    LAX: null,
  };
  for (const r of rows) {
    if (r.rn !== 1) continue;
    const c = r.airport as AirportCode;
    if (!AIRPORT_CODES.includes(c)) continue;
    out[c] = {
      airport: c,
      icao24: r.icao24,
      callsign: r.callsign,
      typecode: r.typecode,
      isHeavy: r.isHeavy,
      occurredAt: r.occurredAt,
    };
  }
  return out;
};

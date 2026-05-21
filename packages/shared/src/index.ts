export const AIRPORT_CODES = ['JFK', 'ORD', 'ATL', 'LAX'] as const;
export type AirportCode = (typeof AIRPORT_CODES)[number];

export type Bbox = {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
};

export const AIRPORT_BBOXES: Record<AirportCode, Bbox> = {
  JFK: { latMin: 40.6, latMax: 40.7, lngMin: -73.85, lngMax: -73.75 },
  ORD: { latMin: 41.93, latMax: 42.03, lngMin: -87.95, lngMax: -87.85 },
  ATL: { latMin: 33.6, latMax: 33.7, lngMin: -84.48, lngMax: -84.38 },
  LAX: { latMin: 33.9, latMax: 34.0, lngMin: -118.45, lngMax: -118.35 },
};

// True airport centers (per AIP/FAA): for radar projection + "near airport" zoning.
export const AIRPORT_CENTERS: Record<AirportCode, { lat: number; lng: number }> = {
  JFK: { lat: 40.6413, lng: -73.7781 },
  ORD: { lat: 41.9742, lng: -87.9073 },
  ATL: { lat: 33.6407, lng: -84.4277 },
  LAX: { lat: 33.9416, lng: -118.4085 },
};

// Predominant runway alignment per airport, in degrees true (one of the two
// reciprocal headings). Used as a visual hint on the radar scope, not for
// actual ATC purposes.
export const AIRPORT_RUNWAY_HEADINGS: Record<AirportCode, number[]> = {
  JFK: [40, 130], // 04/22 + 13/31
  ORD: [90, 40, 10], // 09/27 + 04/22 + 10/28
  ATL: [80, 100], // 08/26 + 10/28
  LAX: [60, 70], // 06/24 + 07/25
};

// Tracker zone radius — how far out from each airport we surface aircraft.
// 1.0° (~60nm lat, ~50nm lng at our latitudes) catches the approach + climb phases.
export const TRACKER_RADIUS_DEG = 1.0;

export const AIRPORT_NAMES: Record<AirportCode, string> = {
  JFK: 'New York (JFK)',
  ORD: 'Chicago (ORD)',
  ATL: 'Atlanta (ATL)',
  LAX: 'Los Angeles (LAX)',
};

export const AIRPORT_COLORS: Record<AirportCode, string> = {
  JFK: '#1e3a8a',
  ORD: '#dc2626',
  ATL: '#eab308',
  LAX: '#06b6d4',
};

export const GLOBAL_BBOX: Bbox = (() => {
  const all = Object.values(AIRPORT_BBOXES);
  return {
    latMin: Math.min(...all.map((b) => b.latMin)) - 0.1,
    latMax: Math.max(...all.map((b) => b.latMax)) + 0.1,
    lngMin: Math.min(...all.map((b) => b.lngMin)) - 0.1,
    lngMax: Math.max(...all.map((b) => b.lngMax)) + 0.1,
  };
})();

// Source: spec — heavy/widebody typecodes (B777, B787, B747, A330, A340, A350, A380)
export const HEAVY_TYPECODES = new Set<string>([
  'B772', 'B773', 'B77W', 'B77L', 'B788', 'B789', 'B78X',
  'B744', 'B748',
  'A332', 'A333', 'A338', 'A339',
  'A342', 'A343', 'A345', 'A346',
  'A359', 'A35K',
  'A388', 'A380',
  'A306', 'A310',
]);

export const isHeavyTypecode = (typecode: string | null | undefined): boolean => {
  if (!typecode) return false;
  return HEAVY_TYPECODES.has(typecode.toUpperCase());
};

export const RACE_TYPES = ['takeoff', 'heavy', 'total_ops'] as const;
export type RaceType = (typeof RACE_TYPES)[number];

export const EVENT_TYPES = ['takeoff', 'landing'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const BET_STATUSES = ['open', 'won', 'lost', 'push'] as const;
export type BetStatus = (typeof BET_STATUSES)[number];

export const BET_TYPES = [
  'race_winner',
  'race_over_under',
  'race_margin',
  'next_event',
  'next_heavy',
  'rolling_over_under',
  'streak',
  'landing_race',
] as const;
export type BetType = (typeof BET_TYPES)[number];

// Per spec: altitude threshold (baro) below which transitions count as airport events
export const TAKEOFF_LANDING_MAX_ALTITUDE_FT = 3000;

export const isInBbox = (lat: number, lng: number, bbox: Bbox): boolean => {
  return (
    lat >= bbox.latMin &&
    lat <= bbox.latMax &&
    lng >= bbox.lngMin &&
    lng <= bbox.lngMax
  );
};

export const airportForPosition = (
  lat: number | null | undefined,
  lng: number | null | undefined
): AirportCode | null => {
  if (lat == null || lng == null) return null;
  for (const code of AIRPORT_CODES) {
    if (isInBbox(lat, lng, AIRPORT_BBOXES[code])) return code;
  }
  return null;
};

/**
 * Returns the nearest airport within TRACKER_RADIUS_DEG, by chebyshev distance
 * on raw lat/lng (cheap, accurate enough at our scale where bboxes never overlap).
 */
export const nearestAirportInRadius = (
  lat: number | null | undefined,
  lng: number | null | undefined,
  radius: number = TRACKER_RADIUS_DEG
): AirportCode | null => {
  if (lat == null || lng == null) return null;
  let best: AirportCode | null = null;
  let bestDist = radius;
  for (const code of AIRPORT_CODES) {
    const c = AIRPORT_CENTERS[code];
    const d = Math.max(Math.abs(lat - c.lat), Math.abs(lng - c.lng));
    if (d <= bestDist) {
      best = code;
      bestDist = d;
    }
  }
  return best;
};

export const STARTING_BALANCE = 10_000;
export const MIN_BET = 10;
export const MAX_BET = 1_000;

// --- Race & time helpers ---

const MATCHUPS_BY_UTC_WEEKDAY: Record<number, [AirportCode, AirportCode] | null> = {
  1: ['JFK', 'ORD'],
  2: ['JFK', 'ATL'],
  3: ['JFK', 'LAX'],
  4: ['ORD', 'ATL'],
  5: ['ORD', 'LAX'],
  6: ['ATL', 'LAX'],
  0: null, // Sunday: rotation
};

const SUNDAY_ROTATION: Array<[AirportCode, AirportCode]> = [
  ['JFK', 'ORD'],
  ['JFK', 'ATL'],
  ['JFK', 'LAX'],
  ['ORD', 'ATL'],
  ['ORD', 'LAX'],
  ['ATL', 'LAX'],
];

export const getFeatureMatchup = (now: Date = new Date()): [AirportCode, AirportCode] => {
  const day = now.getUTCDay();
  const fixed = MATCHUPS_BY_UTC_WEEKDAY[day];
  if (fixed) return fixed;
  const yearStart = Date.UTC(now.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - yearStart) / 86_400_000);
  return SUNDAY_ROTATION[Math.floor(dayOfYear / 7) % SUNDAY_ROTATION.length];
};

export const getCurrentHourStart = (now: Date = new Date()): Date => {
  const d = new Date(now.getTime());
  d.setUTCMinutes(0, 0, 0);
  return d;
};

export const getNextHourStart = (now: Date = new Date()): Date => {
  const d = getCurrentHourStart(now);
  d.setUTCHours(d.getUTCHours() + 1);
  return d;
};

export const msUntilNextHour = (now: Date = new Date()): number =>
  getNextHourStart(now).getTime() - now.getTime();

export const getTodayStartUTC = (now: Date = new Date()): Date => {
  const d = new Date(now.getTime());
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export type AirportScores = Record<AirportCode, number>;
export type AllScores = Record<RaceType, AirportScores>;

export const emptyAirportScores = (): AirportScores => ({
  JFK: 0,
  ORD: 0,
  ATL: 0,
  LAX: 0,
});

export const emptyAllScores = (): AllScores => ({
  takeoff: emptyAirportScores(),
  heavy: emptyAirportScores(),
  total_ops: emptyAirportScores(),
});

export const winnerOf = (scores: AirportScores, only?: AirportCode[]): AirportCode | null => {
  const codes = only ?? (Object.keys(scores) as AirportCode[]);
  let max = -1;
  let winner: AirportCode | null = null;
  for (const c of codes) {
    const s = scores[c] ?? 0;
    if (s > max) {
      max = s;
      winner = c;
    }
  }
  return max > 0 ? winner : null;
};

export * from './bets';
export * from './odds';
export * from './geo';

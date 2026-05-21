import { liveAircraft, getDb, type NewLiveAircraft } from '@airport-pong/db';
import { isHeavyTypecode, nearestAirportInRadius } from '@airport-pong/shared';
import { aircraftDb } from './aircraft-db.ts';
import { metersToFt, type OpenSkyState } from './opensky.ts';

const MS_TO_KT = 1.94384;
const MS_TO_FPM = 196.85;

/** A plane is "actively taxiing" when on the ground and moving at typical
 *  taxi speeds. Below 3kt = stationary/parked; above 35kt = takeoff roll. */
const TAXI_MIN_KT = 3;
const TAXI_MAX_KT = 35;

type PriorState = {
  taxiStartedAt: Date | null;
  onGround: boolean;
};

/**
 * Replaces the `live_aircraft` table with the subset of `states` near any
 * tracked airport. Atomic: a reader between DELETE and INSERT sees the old
 * snapshot under READ COMMITTED isolation.
 *
 * Preserves `taxiStartedAt` across the DELETE+INSERT pattern by pre-reading
 * existing per-icao24 state and re-applying it to new rows. Rules:
 *   - Plane on the ground + taxi velocity + did NOT just transition from
 *     airborne (i.e., not just-landed): keep existing taxiStartedAt if
 *     present, else set to pollTime (first observed taxiing).
 *   - Otherwise (airborne, parked, takeoff roll, just landed): null.
 *
 * "Just landed" check (prior was airborne → now on ground) ensures we
 * don't treat taxi-IN time as taxi-OUT. A plane that lands and later
 * pushes back for its next leg will get a fresh taxiStartedAt at pushback.
 */
export const writeLiveSnapshot = async (
  states: OpenSkyState[],
  pollTime: Date
): Promise<number> => {
  const db = getDb();

  // Pre-read prior state so we can preserve/initialize taxiStartedAt.
  // Tiny payload (one row per tracked plane, ~hundreds), keyed by icao24.
  const priorRows = await db
    .select({
      icao24: liveAircraft.icao24,
      taxiStartedAt: liveAircraft.taxiStartedAt,
      onGround: liveAircraft.onGround,
    })
    .from(liveAircraft);
  const prior = new Map<string, PriorState>();
  for (const r of priorRows) {
    prior.set(r.icao24, { taxiStartedAt: r.taxiStartedAt, onGround: r.onGround });
  }

  const rows: NewLiveAircraft[] = [];
  for (const s of states) {
    const nearest = nearestAirportInRadius(s.latitude, s.longitude);
    if (!nearest) continue;
    const typecode = aircraftDb.typecodeFor(s.icao24);
    const vKt = s.velocityMs != null ? Math.round(s.velocityMs * MS_TO_KT) : null;

    const isActivelyTaxiing =
      s.onGround && vKt != null && vKt >= TAXI_MIN_KT && vKt <= TAXI_MAX_KT;

    const p = prior.get(s.icao24);
    let taxiStartedAt: Date | null = null;
    if (isActivelyTaxiing) {
      const justLanded = p != null && p.onGround === false;
      if (!justLanded) {
        // Either the plane was already taxiing (preserve taxiStartedAt)
        // or it's first time we see it in taxi range (set pollTime).
        taxiStartedAt = p?.taxiStartedAt ?? pollTime;
      }
      // If just-landed: leave taxiStartedAt null. This is taxi-IN, not
      // taxi-OUT — we don't want to mis-predict its "takeoff" time.
    }

    rows.push({
      icao24: s.icao24,
      callsign: s.callsign,
      typecode,
      isHeavy: isHeavyTypecode(typecode),
      nearestAirport: nearest,
      latitude: s.latitude,
      longitude: s.longitude,
      altitudeFt: metersToFt(s.baroAltitudeM ?? s.geoAltitudeM),
      velocityKt: vKt,
      headingDeg: s.trueTrackDeg != null ? Math.round(s.trueTrackDeg) : null,
      verticalRateFpm:
        s.verticalRateMs != null ? Math.round(s.verticalRateMs * MS_TO_FPM) : null,
      onGround: s.onGround,
      taxiStartedAt,
      updatedAt: pollTime,
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(liveAircraft);
    // chunk to keep individual statements reasonably small
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      if (slice.length > 0) await tx.insert(liveAircraft).values(slice);
    }
  });

  return rows.length;
};

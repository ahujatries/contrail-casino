import { liveAircraft, getDb, type NewLiveAircraft } from '@airport-pong/db';
import { isHeavyTypecode, nearestAirportInRadius } from '@airport-pong/shared';
import { aircraftDb } from './aircraft-db.ts';
import { metersToFt, type OpenSkyState } from './opensky.ts';

const MS_TO_KT = 1.94384;
const MS_TO_FPM = 196.85;

/**
 * Replaces the `live_aircraft` table with the subset of `states` near any
 * tracked airport. Atomic: a reader between DELETE and INSERT sees the old
 * snapshot under READ COMMITTED isolation.
 */
export const writeLiveSnapshot = async (
  states: OpenSkyState[],
  pollTime: Date
): Promise<number> => {
  const rows: NewLiveAircraft[] = [];
  for (const s of states) {
    const nearest = nearestAirportInRadius(s.latitude, s.longitude);
    if (!nearest) continue;
    const typecode = aircraftDb.typecodeFor(s.icao24);
    rows.push({
      icao24: s.icao24,
      callsign: s.callsign,
      typecode,
      isHeavy: isHeavyTypecode(typecode),
      nearestAirport: nearest,
      latitude: s.latitude,
      longitude: s.longitude,
      altitudeFt: metersToFt(s.baroAltitudeM ?? s.geoAltitudeM),
      velocityKt: s.velocityMs != null ? Math.round(s.velocityMs * MS_TO_KT) : null,
      headingDeg: s.trueTrackDeg != null ? Math.round(s.trueTrackDeg) : null,
      verticalRateFpm:
        s.verticalRateMs != null ? Math.round(s.verticalRateMs * MS_TO_FPM) : null,
      onGround: s.onGround,
      updatedAt: pollTime,
    });
  }

  const db = getDb();
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

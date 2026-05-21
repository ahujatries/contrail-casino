import {
  airportForPosition,
  TAKEOFF_LANDING_MAX_ALTITUDE_FT,
  type AirportCode,
  type EventType,
} from '@airport-pong/shared';
import { metersToFt, type OpenSkyState } from './opensky.ts';

export type DetectedEvent = {
  airport: AirportCode;
  eventType: EventType;
  icao24: string;
  callsign: string | null;
  altitudeFt: number | null;
  occurredAt: Date;
};

type AircraftCacheEntry = {
  onGround: boolean;
  airport: AirportCode | null;
  altitudeFt: number | null;
  callsign: string | null;
  lastSeenMs: number;
};

const STALE_AFTER_MS = 30 * 60 * 1000; // prune aircraft not seen in 30 min

export class EventDetector {
  private cache = new Map<string, AircraftCacheEntry>();
  private lastPrune = Date.now();

  /**
   * Run one detection pass over the current set of states.
   * Returns events whose on_ground status flipped near a tracked airport at low altitude.
   *
   * Note: we deliberately gate every event on being inside one of the four airport bboxes
   * AND below the altitude threshold. Cruise overflights, missed approaches and go-arounds
   * (which can stay airborne over a field) won't be misclassified as takeoffs/landings.
   */
  process(states: OpenSkyState[], pollUnixSeconds: number): DetectedEvent[] {
    const events: DetectedEvent[] = [];
    const now = pollUnixSeconds * 1000;

    for (const s of states) {
      if (s.latitude == null || s.longitude == null) continue;

      const currentAirport = airportForPosition(s.latitude, s.longitude);
      const currentAltFt = metersToFt(s.baroAltitudeM ?? s.geoAltitudeM);
      const prev = this.cache.get(s.icao24);

      // Update cache early so we always have the latest known state
      const nextEntry: AircraftCacheEntry = {
        onGround: s.onGround,
        airport: currentAirport,
        altitudeFt: currentAltFt,
        callsign: s.callsign,
        lastSeenMs: now,
      };
      this.cache.set(s.icao24, nextEntry);

      if (!prev) continue; // need a previous state to detect a transition

      // Only fire when we have an airport context for THIS sample
      // and the altitude is low enough to be a real takeoff/landing event.
      if (currentAirport == null) continue;
      if (currentAltFt != null && currentAltFt > TAKEOFF_LANDING_MAX_ALTITUDE_FT) continue;

      const wasOnGround = prev.onGround;
      const isOnGround = s.onGround;

      if (wasOnGround === isOnGround) continue;

      const eventType: EventType = wasOnGround ? 'takeoff' : 'landing';

      events.push({
        airport: currentAirport,
        eventType,
        icao24: s.icao24,
        callsign: s.callsign,
        altitudeFt: currentAltFt,
        occurredAt: new Date(now),
      });
    }

    // Periodic prune
    if (now - this.lastPrune > 5 * 60 * 1000) {
      this.prune(now);
      this.lastPrune = now;
    }

    return events;
  }

  private prune(now: number) {
    for (const [k, v] of this.cache) {
      if (now - v.lastSeenMs > STALE_AFTER_MS) this.cache.delete(k);
    }
  }

  cacheSize(): number {
    return this.cache.size;
  }
}

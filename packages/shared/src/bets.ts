import type { AirportCode, RaceType } from './index';

/**
 * Discriminated union of bet payload shapes. `betType` on the row tells you
 * which shape `betPayload` JSONB conforms to.
 */
export type NextEventPayload = {
  airport: AirportCode;
};

export type NextHeavyPayload = {
  airport: AirportCode;
};

export type RaceWinnerPayload = {
  raceType: RaceType;
  airport: AirportCode;
  hourStart: string; // ISO
};

export type RaceOverUnderPayload = {
  raceType: RaceType;
  airport: AirportCode;
  line: number; // e.g. 47.5
  side: 'over' | 'under';
  hourStart: string;
};

export type LandingRacePayload = {
  airport: AirportCode;
  pickedSide: 'left' | 'right';
  leftIcao24: string;
  leftCallsign: string | null;
  rightIcao24: string;
  rightCallsign: string | null;
  // ISO timestamps of approximate landing time at bet placement (for display + timeout)
  expectedLandingAt: string;
  // The pair's bucket identifier (so two clients see the same race)
  pairId: string;
};

export type TakeoffRacePayload = {
  airport: AirportCode;
  pickedSide: 'left' | 'right';
  leftIcao24: string;
  leftCallsign: string | null;
  rightIcao24: string;
  rightCallsign: string | null;
  pairId: string;
};

export type CrossAirportRacePayload = {
  pickedSide: 'left' | 'right';
  leftAirport: AirportCode;
  leftIcao24: string;
  leftCallsign: string | null;
  rightAirport: AirportCode;
  rightIcao24: string;
  rightCallsign: string | null;
  expectedLandingAt: string;
  pairId: string;
};

/** No specific aircraft — first heavy movement at either airport wins. */
export type HeavyRacePayload = {
  pickedSide: 'left' | 'right';
  leftAirport: AirportCode;
  rightAirport: AirportCode;
  pairId: string;
};

/**
 * Per-plane O/U on landing time. User picks one inbound plane from the
 * tracker; system suggests ETA as the line; user picks over or under.
 *  - lineMinuteIso: target timestamp (start of minute, e.g. "...T14:23:00Z")
 *  - under: lands STRICTLY BEFORE lineMinuteIso  → wins on actual < line
 *  - over:  lands STRICTLY AFTER  lineMinuteIso  → wins on actual > line
 *  - exact minute match → push
 *  - no landing within 60 min of placedAt → push (refund)
 */
export type PlaneLandingOuPayload = {
  airport: AirportCode;
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  lineMinuteIso: string;
  side: 'over' | 'under';
  etaMinAtPlacement: number;
  placedAt: string;
};

/**
 * Per-plane O/U on takeoff time. Symmetric to plane_landing_ou but for
 * planes on the ground that are about to depart. Line = system-estimated
 * ETT (time to wheels-up) derived from taxi position/velocity.
 *  - under: takes off BEFORE lineMinuteIso  → wins on actual < line
 *  - over:  takes off AFTER  lineMinuteIso  → wins on actual > line
 *  - ±30s of line → push
 *  - no takeoff within 60 min of placedAt → push (return-to-gate, etc)
 */
export type PlaneTakeoffOuPayload = {
  airport: AirportCode;
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  lineMinuteIso: string;
  side: 'over' | 'under';
  ettMinAtPlacement: number;
  placedAt: string;
};

export type BetPayloadByType = {
  next_event: NextEventPayload;
  next_heavy: NextHeavyPayload;
  race_winner: RaceWinnerPayload;
  race_over_under: RaceOverUnderPayload;
  landing_race: LandingRacePayload;
  takeoff_race: TakeoffRacePayload;
  cross_airport_race: CrossAirportRacePayload;
  heavy_race: HeavyRacePayload;
  plane_landing_ou: PlaneLandingOuPayload;
  plane_takeoff_ou: PlaneTakeoffOuPayload;
};

export type BetTypeKey = keyof BetPayloadByType;

export type PlaceBetInput<K extends BetTypeKey = BetTypeKey> = {
  type: K;
  payload: BetPayloadByType[K];
  stake: number;
};

export const describeBet = (
  type: BetTypeKey,
  payload: BetPayloadByType[BetTypeKey]
): string => {
  switch (type) {
    case 'next_event':
      return `Next takeoff from ${(payload as NextEventPayload).airport}`;
    case 'next_heavy':
      return `Next heavy movement at ${(payload as NextHeavyPayload).airport}`;
    case 'race_winner': {
      const p = payload as RaceWinnerPayload;
      const race = p.raceType === 'total_ops' ? 'Total Ops' : p.raceType === 'heavy' ? 'Heavy' : 'Takeoff';
      return `${p.airport} wins this hour's ${race} race`;
    }
    case 'race_over_under': {
      const p = payload as RaceOverUnderPayload;
      const race = p.raceType === 'total_ops' ? 'Total Ops' : p.raceType === 'heavy' ? 'Heavy' : 'Takeoff';
      return `${p.airport} ${p.side === 'over' ? 'OVER' : 'UNDER'} ${p.line} in ${race}`;
    }
    case 'landing_race': {
      const p = payload as LandingRacePayload;
      const pick = p.pickedSide === 'left' ? p.leftCallsign : p.rightCallsign;
      const other = p.pickedSide === 'left' ? p.rightCallsign : p.leftCallsign;
      return `${p.airport} · ${pick ?? 'A'} lands before ${other ?? 'B'}`;
    }
    case 'takeoff_race': {
      const p = payload as TakeoffRacePayload;
      const pick = p.pickedSide === 'left' ? p.leftCallsign : p.rightCallsign;
      const other = p.pickedSide === 'left' ? p.rightCallsign : p.leftCallsign;
      return `${p.airport} · ${pick ?? 'A'} takes off before ${other ?? 'B'}`;
    }
    case 'cross_airport_race': {
      const p = payload as CrossAirportRacePayload;
      const pickAp = p.pickedSide === 'left' ? p.leftAirport : p.rightAirport;
      const pickCs = p.pickedSide === 'left' ? p.leftCallsign : p.rightCallsign;
      const otherAp = p.pickedSide === 'left' ? p.rightAirport : p.leftAirport;
      return `${pickCs ?? pickAp} (${pickAp}) lands before plane to ${otherAp}`;
    }
    case 'heavy_race': {
      const p = payload as HeavyRacePayload;
      const pick = p.pickedSide === 'left' ? p.leftAirport : p.rightAirport;
      const other = p.pickedSide === 'left' ? p.rightAirport : p.leftAirport;
      return `${pick} gets next heavy before ${other}`;
    }
    case 'plane_landing_ou': {
      const p = payload as PlaneLandingOuPayload;
      const line = new Date(p.lineMinuteIso).toISOString().slice(11, 16); // HH:MM UTC
      const id = p.callsign ?? p.icao24.toUpperCase();
      return `${id} (${p.airport}) ${p.side === 'over' ? 'OVER' : 'UNDER'} ${line} UTC landing`;
    }
    case 'plane_takeoff_ou': {
      const p = payload as PlaneTakeoffOuPayload;
      const line = new Date(p.lineMinuteIso).toISOString().slice(11, 16);
      const id = p.callsign ?? p.icao24.toUpperCase();
      return `${id} (${p.airport}) ${p.side === 'over' ? 'OVER' : 'UNDER'} ${line} UTC takeoff`;
    }
  }
};

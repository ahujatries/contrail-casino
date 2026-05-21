import { NextResponse } from 'next/server';
import {
  getCurrentHourScores,
  getDepartingPlanesForAirport,
  getHourlyLineForAirport,
  getHourlyTakeoffLineForAirport,
  getInboundPlanesForAirport,
  getPaceByAirport,
} from '@airport-pong/db';
import {
  AIRPORT_CODES,
  getCurrentHourStart,
  msUntilNextHour,
  raceOverUnderOdds,
  type AirportCode,
} from '@airport-pong/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type BoardCategory = 'hourly' | 'landing' | 'takeoff';

export type BoardPick = {
  side: 'over' | 'under';
  label: string;
  odds: string;
  betType: 'race_over_under' | 'plane_landing_ou' | 'plane_takeoff_ou';
  payload: Record<string, unknown>;
};

export type BoardMarket = {
  id: string;
  category: BoardCategory;
  airport: AirportCode;
  title: string;
  sub: string;
  picks: BoardPick[];
  locked?: boolean;
};

/**
 * One call returning every open market across all 4 airports:
 *   - 8 hourly O/U markets (4 airports × {total_ops, takeoff})
 *   - N per-plane landing O/U (one per inbound plane with ETA > 8min)
 *   - N per-plane takeoff O/U (one per departing plane with ETT > 4min)
 *
 * Each market's picks include the full bet payload + type, so the client
 * just calls placeBet(pick.betType, pick.payload, stake) when the user
 * confirms a pick.
 */
export async function GET() {
  const now = new Date();
  const hourStart = getCurrentHourStart(now);
  const msUntilEnd = msUntilNextHour(now);
  const minsRemaining = Math.max(1, Math.round(msUntilEnd / 60_000));
  const locked = (60 * 60_000 - msUntilEnd) / 60_000 >= 30;

  const [scores, totalPace, takeoffPace, ...perAirport] = await Promise.all([
    getCurrentHourScores(now),
    getPaceByAirport(30, 'all'),
    getPaceByAirport(30, 'takeoff'),
    ...AIRPORT_CODES.flatMap((a) => [
      getHourlyLineForAirport(a, hourStart),
      getHourlyTakeoffLineForAirport(a, hourStart),
      getInboundPlanesForAirport(a),
      getDepartingPlanesForAirport(a),
    ]),
  ]);

  const markets: BoardMarket[] = [];

  for (let i = 0; i < AIRPORT_CODES.length; i++) {
    const airport = AIRPORT_CODES[i] as AirportCode;
    const baseIdx = i * 4;
    const hourly = perAirport[baseIdx] as Awaited<ReturnType<typeof getHourlyLineForAirport>>;
    const hourlyTakeoff = perAirport[baseIdx + 1] as Awaited<ReturnType<typeof getHourlyTakeoffLineForAirport>>;
    const inbound = perAirport[baseIdx + 2] as Awaited<ReturnType<typeof getInboundPlanesForAirport>>;
    const departing = perAirport[baseIdx + 3] as Awaited<ReturnType<typeof getDepartingPlanesForAirport>>;

    // Hourly total ops O/U
    const totalOpsOdds = raceOverUnderOdds({
      currentScore: scores.total_ops[airport] ?? 0,
      pace: totalPace[airport] ?? 0,
      minutesRemaining: minsRemaining,
      line: hourly.line,
    });
    markets.push({
      id: `hourly-total-${airport}`,
      category: 'hourly',
      airport,
      title: `${airport} · Total Ops`,
      sub: `LINE ${hourly.line} · SO FAR ${scores.total_ops[airport] ?? 0} · PROJ ${Math.round(totalOpsOdds.expected)}`,
      locked,
      picks: [
        {
          side: 'over',
          label: `Over ${hourly.line}`,
          odds: totalOpsOdds.over.american,
          betType: 'race_over_under',
          payload: { raceType: 'total_ops', airport, line: hourly.line, side: 'over', hourStart: hourly.hourStart },
        },
        {
          side: 'under',
          label: `Under ${hourly.line}`,
          odds: totalOpsOdds.under.american,
          betType: 'race_over_under',
          payload: { raceType: 'total_ops', airport, line: hourly.line, side: 'under', hourStart: hourly.hourStart },
        },
      ],
    });

    // Hourly takeoffs-only O/U
    const tkOdds = raceOverUnderOdds({
      currentScore: scores.takeoff[airport] ?? 0,
      pace: takeoffPace[airport] ?? 0,
      minutesRemaining: minsRemaining,
      line: hourlyTakeoff.line,
    });
    markets.push({
      id: `hourly-takeoff-${airport}`,
      category: 'hourly',
      airport,
      title: `${airport} · Takeoffs`,
      sub: `LINE ${hourlyTakeoff.line} · SO FAR ${scores.takeoff[airport] ?? 0} · PROJ ${Math.round(tkOdds.expected)}`,
      locked,
      picks: [
        {
          side: 'over',
          label: `Over ${hourlyTakeoff.line}`,
          odds: tkOdds.over.american,
          betType: 'race_over_under',
          payload: { raceType: 'takeoff', airport, line: hourlyTakeoff.line, side: 'over', hourStart: hourlyTakeoff.hourStart },
        },
        {
          side: 'under',
          label: `Under ${hourlyTakeoff.line}`,
          odds: tkOdds.under.american,
          betType: 'race_over_under',
          payload: { raceType: 'takeoff', airport, line: hourlyTakeoff.line, side: 'under', hourStart: hourlyTakeoff.hourStart },
        },
      ],
    });

    // Per-plane landing markets
    for (const p of inbound) {
      const eta = new Date(p.expectedLandingAt);
      eta.setUTCSeconds(0, 0);
      const lineMinuteIso = eta.toISOString();
      const lineLabel = lineMinuteIso.slice(11, 16);
      markets.push({
        id: `landing-${airport}-${p.icao24}`,
        category: 'landing',
        airport,
        title: `${airport} · ${p.callsign ?? p.icao24.toUpperCase()}`,
        sub: `${p.typecode ?? '—'}${p.isHeavy ? ' [H]' : ''} · ETA ${Math.round(p.etaMin)}m · ${Math.round(p.distanceNm)}nm out`,
        picks: [
          {
            side: 'under',
            label: `Before ${lineLabel}`,
            odds: '-125',
            betType: 'plane_landing_ou',
            payload: {
              airport, icao24: p.icao24, callsign: p.callsign, typecode: p.typecode,
              lineMinuteIso, side: 'under',
              etaMinAtPlacement: p.etaMin, placedAt: now.toISOString(),
            },
          },
          {
            side: 'over',
            label: `After ${lineLabel}`,
            odds: '+105',
            betType: 'plane_landing_ou',
            payload: {
              airport, icao24: p.icao24, callsign: p.callsign, typecode: p.typecode,
              lineMinuteIso, side: 'over',
              etaMinAtPlacement: p.etaMin, placedAt: now.toISOString(),
            },
          },
        ],
      });
    }

    // Per-plane takeoff markets
    for (const p of departing) {
      const ett = new Date(p.expectedTakeoffAt);
      ett.setUTCSeconds(0, 0);
      const lineMinuteIso = ett.toISOString();
      const lineLabel = lineMinuteIso.slice(11, 16);
      markets.push({
        id: `takeoff-${airport}-${p.icao24}`,
        category: 'takeoff',
        airport,
        title: `${airport} · ${p.callsign ?? p.icao24.toUpperCase()}`,
        sub: `${p.typecode ?? '—'}${p.isHeavy ? ' [H]' : ''} · ETT ${Math.round(p.ettMin)}m · taxiing ${p.velocityKt}kt`,
        picks: [
          {
            side: 'under',
            label: `Before ${lineLabel}`,
            odds: '-130',
            betType: 'plane_takeoff_ou',
            payload: {
              airport, icao24: p.icao24, callsign: p.callsign, typecode: p.typecode,
              lineMinuteIso, side: 'under',
              ettMinAtPlacement: p.ettMin, placedAt: now.toISOString(),
            },
          },
          {
            side: 'over',
            label: `After ${lineLabel}`,
            odds: '+110',
            betType: 'plane_takeoff_ou',
            payload: {
              airport, icao24: p.icao24, callsign: p.callsign, typecode: p.typecode,
              lineMinuteIso, side: 'over',
              ettMinAtPlacement: p.ettMin, placedAt: now.toISOString(),
            },
          },
        ],
      });
    }
  }

  return NextResponse.json(
    { fetchedAt: now.toISOString(), msUntilHourEnd: msUntilEnd, locked, markets },
    { headers: { 'Cache-Control': 'public, max-age=15, stale-while-revalidate=30' } }
  );
}

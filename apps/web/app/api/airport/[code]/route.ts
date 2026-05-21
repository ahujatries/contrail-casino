import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentHourScores,
  getDb,
  getDepartingPlanesForAirport,
  getHourlyLineForAirport,
  getHourlyTakeoffLineForAirport,
  getInboundPlanesForAirport,
  liveAircraft,
} from '@airport-pong/db';
import { eq, sql } from 'drizzle-orm';
import {
  AIRPORT_CODES,
  getCurrentHourStart,
  msUntilNextHour,
  raceOverUnderOdds,
  type AirportCode,
} from '@airport-pong/shared';
import { getPaceByAirport } from '@airport-pong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One call for everything the per-airport page needs:
 *   GET /api/airport/JFK
 *
 * Returns:
 *   - traffic[]              aircraft tracked near this airport
 *   - hour { line, currentCount, hourStart, hourEnd, msUntilHourEnd, locked }
 *   - inbound[]              approaching planes with ETA (for plane O/U picker)
 *   - freshness { ageSec }
 *
 * Bets lock at xx:30 (half the hour gone — less skewable by mid-hour spikes).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const airport = code.toUpperCase() as AirportCode;
  if (!AIRPORT_CODES.includes(airport)) {
    return NextResponse.json({ error: 'unknown airport' }, { status: 404 });
  }

  const db = getDb();
  const now = new Date();
  const hourStart = getCurrentHourStart(now);
  const hourEnd = new Date(hourStart.getTime() + 60 * 60_000);
  const msUntilEnd = msUntilNextHour(now);
  const minutesIntoHour = (60 * 60_000 - msUntilEnd) / 60_000;
  const locked = minutesIntoHour >= 30;

  const [trafficRows, hourly, hourlyTakeoff, scores, inbound, departing, latestRow,
         totalPaceByAirport, takeoffPaceByAirport] = await Promise.all([
    db
      .select()
      .from(liveAircraft)
      .where(eq(liveAircraft.nearestAirport, airport)),
    getHourlyLineForAirport(airport, hourStart),
    getHourlyTakeoffLineForAirport(airport, hourStart),
    getCurrentHourScores(now),
    getInboundPlanesForAirport(airport),
    getDepartingPlanesForAirport(airport),
    db
      .select({ ts: sql<string>`max(${liveAircraft.updatedAt})` })
      .from(liveAircraft),
    getPaceByAirport(30, 'all'),
    getPaceByAirport(30, 'takeoff'),
  ]);

  // Honest over/under odds for both markets, using pace + time remaining.
  const minutesRemaining = Math.max(1, Math.round(msUntilEnd / 60_000));
  const totalOpsOdds = raceOverUnderOdds({
    currentScore: scores.total_ops[airport] ?? 0,
    pace: totalPaceByAirport[airport] ?? 0,
    minutesRemaining,
    line: hourly.line,
  });
  const takeoffOdds = raceOverUnderOdds({
    currentScore: scores.takeoff[airport] ?? 0,
    pace: takeoffPaceByAirport[airport] ?? 0,
    minutesRemaining,
    line: hourlyTakeoff.line,
  });

  const latest = latestRow[0]?.ts ? new Date(latestRow[0].ts) : null;
  const ageSec = latest ? Math.floor((now.getTime() - latest.getTime()) / 1000) : null;

  const traffic = trafficRows.map((r) => ({
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
    updatedAt: r.updatedAt.toISOString(),
  }));

  return NextResponse.json(
    {
      fetchedAt: now.toISOString(),
      airport,
      hour: {
        hourStart: hourly.hourStart,
        hourEnd: hourly.hourEnd,
        msUntilHourEnd: msUntilEnd,
        // Total-ops O/U (takeoffs + landings)
        line: hourly.line,
        sampleHours: hourly.sampleHours,
        lineSource: hourly.source,
        currentCount: scores.total_ops[airport] ?? 0,
        projection: Math.round(totalOpsOdds.expected),
        overOdds: totalOpsOdds.over.american,
        underOdds: totalOpsOdds.under.american,
        // Takeoffs-only O/U
        takeoffLine: hourlyTakeoff.line,
        takeoffSampleHours: hourlyTakeoff.sampleHours,
        takeoffLineSource: hourlyTakeoff.source,
        takeoffCount: scores.takeoff[airport] ?? 0,
        takeoffProjection: Math.round(takeoffOdds.expected),
        takeoffOverOdds: takeoffOdds.over.american,
        takeoffUnderOdds: takeoffOdds.under.american,
        locked,
      },
      freshness: { latestLiveAircraftAt: latest?.toISOString() ?? null, ageSec },
      traffic,
      inbound,
      departing,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
      },
    }
  );
}

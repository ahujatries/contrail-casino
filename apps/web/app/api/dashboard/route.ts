import { NextRequest, NextResponse } from 'next/server';
import {
  getNextLandingForAirport,
  getNextTakeoffForAirport,
  getDb,
  liveAircraft,
} from '@airport-pong/db';
import { eq, sql } from 'drizzle-orm';
import { AIRPORT_CODES, type AirportCode } from '@airport-pong/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * One call. All the per-airport live data the dashboard needs:
 *   - traffic[] (aircraft within ~60nm)
 *   - takeoff (highest-velocity taxiing on-ground)
 *   - landing (lowest-ETA approach airborne)
 * Filtered to whichever airports the client asks for.
 *
 *   GET /api/dashboard?airports=ORD,ATL
 */
export async function GET(req: NextRequest) {
  const airportsParam = req.nextUrl.searchParams.get('airports') ?? '';
  const requested = airportsParam
    .split(',')
    .map((s) => s.trim().toUpperCase() as AirportCode)
    .filter((s) => AIRPORT_CODES.includes(s));

  const airports = requested.length > 0 ? requested : (AIRPORT_CODES as readonly AirportCode[]);
  const db = getDb();

  // Single SQL pass for traffic of all requested airports
  const trafficRows = await db
    .select()
    .from(liveAircraft)
    .where(sql`${liveAircraft.nearestAirport} = ANY(${airports as unknown as string[]})`);

  // Group by airport
  const traffic: Record<string, ReturnType<typeof toRow>[]> = {};
  for (const c of airports) traffic[c] = [];
  for (const r of trafficRows) {
    const c = r.nearestAirport;
    if (c && traffic[c]) traffic[c].push(toRow(r));
  }

  // Featured "next to depart" + "next to land" per airport
  const [takeoffs, landings] = await Promise.all([
    Promise.all(airports.map((a) => getNextTakeoffForAirport(a))),
    Promise.all(airports.map((a) => getNextLandingForAirport(a))),
  ]);

  // Latest live_aircraft.updated_at for freshness reporting
  const maxRow = await db
    .select({ ts: sql<string>`max(${liveAircraft.updatedAt})` })
    .from(liveAircraft);
  const latest = maxRow[0]?.ts ? new Date(maxRow[0].ts) : null;
  const ageSec = latest ? Math.floor((Date.now() - latest.getTime()) / 1000) : null;

  const airportsOut: Record<string, unknown> = {};
  airports.forEach((a, i) => {
    airportsOut[a] = {
      traffic: traffic[a] ?? [],
      takeoff: takeoffs[i] ?? null,
      landing: landings[i] ?? null,
    };
  });

  return NextResponse.json(
    {
      fetchedAt: new Date().toISOString(),
      freshness: { latestLiveAircraftAt: latest?.toISOString() ?? null, ageSec },
      airports: airportsOut,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
      },
    }
  );
}

function toRow(r: typeof liveAircraft.$inferSelect) {
  return {
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
  };
}

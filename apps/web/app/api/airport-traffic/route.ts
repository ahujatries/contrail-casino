import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { AIRPORT_CODES, type AirportCode } from '@airport-pong/shared';
import { getDb, liveAircraft } from '@airport-pong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const airport = req.nextUrl.searchParams.get('airport') as AirportCode | null;
  if (!airport || !AIRPORT_CODES.includes(airport)) {
    return NextResponse.json({ error: 'invalid airport' }, { status: 400 });
  }
  const db = getDb();
  const rows = await db.select().from(liveAircraft).where(eq(liveAircraft.nearestAirport, airport));
  return NextResponse.json(
    {
      aircraft: rows.map((r) => ({
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
      })),
      fetchedAt: new Date().toISOString(),
    },
    {
      headers: {
        // Worker writes a new snapshot every 30s — let the browser/CDN serve
        // a cached response in between. stale-while-revalidate keeps it snappy.
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
      },
    }
  );
}

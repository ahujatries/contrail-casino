import { NextRequest, NextResponse } from 'next/server';
import { AIRPORT_CODES, type AirportCode } from '@airport-pong/shared';
import { getFeaturedFlightForAirport } from '@airport-pong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const airport = req.nextUrl.searchParams.get('airport') as AirportCode | null;
  if (!airport || !AIRPORT_CODES.includes(airport)) {
    return NextResponse.json({ error: 'invalid airport' }, { status: 400 });
  }
  const flight = await getFeaturedFlightForAirport(airport);
  return NextResponse.json(
    { flight, fetchedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
      },
    }
  );
}

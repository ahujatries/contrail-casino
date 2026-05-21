import { NextRequest, NextResponse } from 'next/server';
import { AIRPORT_CODES, type AirportCode } from '@airport-pong/shared';
import { getLandingRacesForAirport } from '@airport-pong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const airport = req.nextUrl.searchParams.get('airport') as AirportCode | null;
  if (airport && !AIRPORT_CODES.includes(airport)) {
    return NextResponse.json({ error: 'invalid airport' }, { status: 400 });
  }
  const airports = airport ? [airport] : (AIRPORT_CODES as readonly AirportCode[]);
  const all = await Promise.all(airports.map((a) => getLandingRacesForAirport(a)));
  const pairs = all.flat();
  return NextResponse.json(
    { pairs, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

import { NextResponse } from 'next/server';
import { AIRPORT_CODES } from '@airport-pong/shared';
import { getTakeoffRacesForAirport } from '@airport-pong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const all = await Promise.all(AIRPORT_CODES.map((c) => getTakeoffRacesForAirport(c)));
  return NextResponse.json(
    { pairs: all.flat(), fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

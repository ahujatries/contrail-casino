import { NextRequest, NextResponse } from 'next/server';
import {
  AIRPORT_CODES,
  getFeatureMatchup,
  type AirportCode,
} from '@airport-pong/shared';
import { getCrossAirportRaces } from '@airport-pong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const a = req.nextUrl.searchParams.get('a') as AirportCode | null;
  const b = req.nextUrl.searchParams.get('b') as AirportCode | null;
  let pair: [AirportCode, AirportCode];
  if (a && b && AIRPORT_CODES.includes(a) && AIRPORT_CODES.includes(b) && a !== b) {
    pair = [a, b];
  } else {
    pair = getFeatureMatchup();
  }
  const pairs = await getCrossAirportRaces(pair[0], pair[1]);
  return NextResponse.json(
    { airportPair: pair, pairs, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

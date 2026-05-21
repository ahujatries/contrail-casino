import { NextResponse } from 'next/server';
import { listHeavyRacePairs, getPaceByAirport } from '@airport-pong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const [heavyPace, pairs] = await Promise.all([
    getPaceByAirport(60, 'heavy'),
    Promise.resolve(listHeavyRacePairs()),
  ]);
  const enriched = pairs.map((p) => {
    const left = Math.max(0.1, heavyPace[p.leftAirport]);
    const right = Math.max(0.1, heavyPace[p.rightAirport]);
    const total = left + right;
    return {
      ...p,
      leftPace: heavyPace[p.leftAirport],
      rightPace: heavyPace[p.rightAirport],
      probLeft: left / total,
    };
  });
  return NextResponse.json(
    { pairs: enriched, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

import { NextResponse } from 'next/server';
import { getLiveAircraft } from '@airport-pong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await getLiveAircraft();
  // Serialise updatedAt to ISO for transport
  const payload = rows.map((r) => ({
    ...r,
    updatedAt: r.updatedAt.toISOString(),
  }));
  return NextResponse.json(
    { aircraft: payload, fetchedAt: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

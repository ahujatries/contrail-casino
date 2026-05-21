import { NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { events as eventsTable, getDb, liveAircraft } from '@airport-pong/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Returns the freshness of the live data pipeline so the UI can show a
 * "data stale" pill if the worker has gone quiet.
 */
export async function GET() {
  const db = getDb();
  // newest live_aircraft.updated_at + newest events.occurred_at
  const [liveRows, eventRows] = await Promise.all([
    db
      .select({ ts: sql<string>`max(${liveAircraft.updatedAt})` })
      .from(liveAircraft),
    db
      .select({ ts: sql<string>`max(${eventsTable.occurredAt})` })
      .from(eventsTable),
  ]);

  const liveTs = liveRows[0]?.ts ? new Date(liveRows[0].ts) : null;
  const eventTs = eventRows[0]?.ts ? new Date(eventRows[0].ts) : null;
  const now = Date.now();

  return NextResponse.json(
    {
      now: new Date(now).toISOString(),
      liveAircraftLatestAt: liveTs?.toISOString() ?? null,
      liveAircraftAgeSec: liveTs ? Math.floor((now - liveTs.getTime()) / 1000) : null,
      eventsLatestAt: eventTs?.toISOString() ?? null,
      eventsAgeSec: eventTs ? Math.floor((now - eventTs.getTime()) / 1000) : null,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

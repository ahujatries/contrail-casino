/**
 * Quick stats dump from the events table — for verifying the worker is
 * producing reasonable data without opening a SQL client.
 *
 *   pnpm --filter worker exec tsx --env-file=../../.env.local src/stats.ts
 */
import { sql, desc, gte } from 'drizzle-orm';
import { events as eventsTable, getDb, aircraftTypes } from '@airport-pong/db';

async function main() {
  const db = getDb();

  // Counts by airport in the last hour
  const sinceHour = new Date(Date.now() - 60 * 60 * 1000);

  const byAirport = await db
    .select({
      airport: eventsTable.airport,
      eventType: eventsTable.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(eventsTable)
    .where(gte(eventsTable.occurredAt, sinceHour))
    .groupBy(eventsTable.airport, eventsTable.eventType)
    .orderBy(eventsTable.airport, eventsTable.eventType);

  console.log('\n=== Events in the last hour ===');
  if (byAirport.length === 0) {
    console.log('(no events yet)');
  } else {
    for (const r of byAirport) {
      console.log(`  ${r.airport} ${r.eventType.padEnd(8)} ${String(r.count).padStart(4)}`);
    }
  }

  // Last 15 events
  const recent = await db
    .select()
    .from(eventsTable)
    .orderBy(desc(eventsTable.occurredAt))
    .limit(15);

  console.log('\n=== Last 15 events ===');
  for (const e of recent) {
    const t = e.occurredAt.toISOString().slice(11, 19);
    const cs = (e.callsign || '????').padEnd(8);
    const tc = (e.typecode || '?').padEnd(5);
    const heavy = e.isHeavy ? 'H' : ' ';
    const alt = e.altitudeFt != null ? `${String(e.altitudeFt).padStart(5)}ft` : '       ';
    console.log(
      `  ${t}  ${e.airport}  ${e.eventType.padEnd(8)} ${cs} ${tc} ${heavy} ${alt} ${e.icao24}`
    );
  }

  // Aircraft DB stats
  const acStats = await db
    .select({
      total: sql<number>`count(*)::int`,
      heavies: sql<number>`count(*) filter (where is_heavy = true)::int`,
      withType: sql<number>`count(*) filter (where typecode is not null and typecode != '')::int`,
    })
    .from(aircraftTypes);
  console.log('\n=== Aircraft DB ===');
  console.log(`  total:     ${acStats[0].total}`);
  console.log(`  with type: ${acStats[0].withType}`);
  console.log(`  heavies:   ${acStats[0].heavies}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

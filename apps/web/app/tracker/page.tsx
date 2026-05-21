import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';
import {
  getCurrentHourScores,
  getDepartingPlanesForAirport,
  getHourlyLineForAirport,
  getInboundPlanesForAirport,
  getDb,
  liveAircraft,
} from '@airport-pong/db';
import { eq } from 'drizzle-orm';
import { AIRPORT_CODES, getCurrentHourStart, type AirportCode } from '@airport-pong/shared';
import { TrackerScreenV2 } from './_components/TrackerScreenV2';
import type { Aircraft } from '../_components/MapTracker';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Airport Pong · Tracker' };

const DEFAULT_AIRPORT: AirportCode = AIRPORT_CODES[0];

export default async function TrackerPage() {
  const user = await getCurrentUser();
  const now = new Date();
  const hourStart = getCurrentHourStart(now);
  const db = getDb();

  const [scores, line, inbound, departing, trafficRows] = await Promise.all([
    getCurrentHourScores(now),
    getHourlyLineForAirport(DEFAULT_AIRPORT, hourStart),
    getInboundPlanesForAirport(DEFAULT_AIRPORT),
    getDepartingPlanesForAirport(DEFAULT_AIRPORT),
    db.select().from(liveAircraft).where(eq(liveAircraft.nearestAirport, DEFAULT_AIRPORT)),
  ]);

  const traffic: Aircraft[] = trafficRows.map((r) => ({
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
  }));

  if (!user) {
    return (
      <main className="screen"><div className="screen-inner">
        Setting up your callsign… refresh the page.
      </div></main>
    );
  }

  return (
    <div className="app" data-route="tracker">
      <TopBar callsign={user.callsign} balance={user.balance} active="tracker" />
      <TrackerScreenV2
        initialAirport={DEFAULT_AIRPORT}
        initialScores={{
          jfk: { takeoff: scores.takeoff.JFK ?? 0, totalOps: scores.total_ops.JFK ?? 0 },
          ord: { takeoff: scores.takeoff.ORD ?? 0, totalOps: scores.total_ops.ORD ?? 0 },
          atl: { takeoff: scores.takeoff.ATL ?? 0, totalOps: scores.total_ops.ATL ?? 0 },
          lax: { takeoff: scores.takeoff.LAX ?? 0, totalOps: scores.total_ops.LAX ?? 0 },
        }}
        initialLine={line.line}
        initialTraffic={traffic}
        initialInbound={inbound}
        initialDeparting={departing}
      />
    </div>
  );
}

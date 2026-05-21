import {
  getActiveBetsForUser,
  getCurrentHourScores,
  getFeaturedFlightForAirport,
  getPaceByAirport,
  getRecentEvents,
  getTodayTotals,
} from '@airport-pong/db';
import { AIRPORT_CODES, getFeatureMatchup, type AirportCode } from '@airport-pong/shared';
import { getCurrentUser } from '../lib/session';
import { LiveDashboard } from './_components/LiveDashboard';
import type { ActiveBet } from './_components/ActiveBets';
import type { LiveFlight } from './_components/FlightTracker';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const now = new Date();
  const featured = getFeatureMatchup(now);

  const user = await getCurrentUser();
  const [
    scores,
    todayTotals,
    recent,
    takeoffPace,
    heavyPace,
    totalPace,
    userBets,
    flightA,
    flightB,
  ] = await Promise.all([
    getCurrentHourScores(now),
    getTodayTotals(now),
    getRecentEvents(25),
    getPaceByAirport(30, 'takeoff'),
    getPaceByAirport(60, 'heavy'),
    getPaceByAirport(30, 'all'),
    user ? getActiveBetsForUser(user.id) : Promise.resolve([]),
    getFeaturedFlightForAirport(featured[0]),
    getFeaturedFlightForAirport(featured[1]),
  ]);

  const initialEvents = recent.map((e) => ({
    id: e.id,
    airport: e.airport,
    eventType: e.eventType,
    callsign: e.callsign,
    typecode: e.typecode,
    isHeavy: e.isHeavy,
    occurredAt: e.occurredAt.toISOString(),
  }));

  const initialBets: ActiveBet[] = userBets.map((b) => ({
    id: b.id,
    betType: b.betType,
    betPayload: b.betPayload,
    stake: b.stake,
    potentialPayout: b.potentialPayout,
    status: b.status,
    placedAt: b.placedAt.toISOString(),
    resolvedAt: b.resolvedAt ? b.resolvedAt.toISOString() : null,
  }));

  const liveFlights: Record<AirportCode, LiveFlight | null> = {
    JFK: null,
    ORD: null,
    ATL: null,
    LAX: null,
  };
  if (flightA) liveFlights[featured[0]] = flightA;
  if (flightB) liveFlights[featured[1]] = flightB;

  if (!user) {
    return (
      <main className="page-shell">
        <div className="container">Setting up your callsign… refresh the page.</div>
      </main>
    );
  }

  return (
    <LiveDashboard
      user={{ id: user.id, callsign: user.callsign, balance: user.balance }}
      featured={featured}
      initialScores={scores}
      initialTodayTotals={todayTotals}
      initialEvents={initialEvents}
      initialPace={{ takeoff: takeoffPace, heavy: heavyPace, total: totalPace }}
      initialBets={initialBets}
      liveFlights={liveFlights}
    />
  );
}

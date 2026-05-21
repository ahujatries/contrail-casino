import {
  getActiveBetsForUser,
  getCurrentHourScores,
  getNextLandingForAirport,
  getNextTakeoffForAirport,
  getPaceByAirport,
  getRecentEvents,
} from '@airport-pong/db';
import { AIRPORT_CODES, getFeatureMatchup, type AirportCode } from '@airport-pong/shared';
import { getCurrentUser } from '../lib/session';
import { LiveDashboard } from './_components/LiveDashboard';
import type { ActiveBet } from './_components/ActiveBets';
import type { DuelLandingFlight, DuelTakeoffFlight } from '@airport-pong/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const now = new Date();
  const featured = getFeatureMatchup(now);
  const user = await getCurrentUser();

  const [
    scores,
    recent,
    takeoffPace,
    heavyPace,
    totalPace,
    userBets,
    toA,
    toB,
    ldgA,
    ldgB,
  ] = await Promise.all([
    getCurrentHourScores(now),
    getRecentEvents(25),
    getPaceByAirport(30, 'takeoff'),
    getPaceByAirport(60, 'heavy'),
    getPaceByAirport(30, 'all'),
    user ? getActiveBetsForUser(user.id) : Promise.resolve([]),
    getNextTakeoffForAirport(featured[0]),
    getNextTakeoffForAirport(featured[1]),
    getNextLandingForAirport(featured[0]),
    getNextLandingForAirport(featured[1]),
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

  const takeoffFlights: Record<AirportCode, DuelTakeoffFlight | null> = {
    JFK: null, ORD: null, ATL: null, LAX: null,
  };
  takeoffFlights[featured[0]] = toA;
  takeoffFlights[featured[1]] = toB;

  const landingFlights: Record<AirportCode, DuelLandingFlight | null> = {
    JFK: null, ORD: null, ATL: null, LAX: null,
  };
  landingFlights[featured[0]] = ldgA;
  landingFlights[featured[1]] = ldgB;

  if (!user) {
    return (
      <main className="screen">
        <div className="screen-inner">Setting up your callsign… refresh the page.</div>
      </main>
    );
  }

  return (
    <LiveDashboard
      user={{ id: user.id, callsign: user.callsign, balance: user.balance }}
      featured={featured}
      initialScores={scores}
      initialEvents={initialEvents}
      initialPace={{ takeoff: takeoffPace, heavy: heavyPace, total: totalPace }}
      initialBets={initialBets}
      takeoffFlights={takeoffFlights}
      landingFlights={landingFlights}
    />
  );
}

import { notFound } from 'next/navigation';
import {
  getActiveBetsForUser,
  getDepartingPlanesForAirport,
  getHourlyLineForAirport,
  getHourlyTakeoffLineForAirport,
  getInboundPlanesForAirport,
  getCurrentHourScores,
  type DepartingPlane,
  type InboundPlane,
} from '@airport-pong/db';
import {
  AIRPORT_CODES,
  AIRPORT_NAMES,
  getCurrentHourStart,
  type AirportCode,
} from '@airport-pong/shared';
import { getCurrentUser } from '../../../lib/session';
import { AirportDashboard } from './_components/AirportDashboard';
import type { ActiveBet } from '../../_components/ActiveBets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Params = Promise<{ code: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { code } = await params;
  const airport = code.toUpperCase() as AirportCode;
  if (!AIRPORT_CODES.includes(airport)) return { title: 'Airport not found' };
  return { title: `${airport} · ${AIRPORT_NAMES[airport]} — Contrail Casino` };
}

export default async function AirportPage({ params }: { params: Params }) {
  const { code } = await params;
  const airport = code.toUpperCase() as AirportCode;
  if (!AIRPORT_CODES.includes(airport)) notFound();

  const now = new Date();
  const hourStart = getCurrentHourStart(now);
  const user = await getCurrentUser();

  const [hourly, hourlyTakeoff, scores, inbound, departing, userBets] = await Promise.all([
    getHourlyLineForAirport(airport, hourStart),
    getHourlyTakeoffLineForAirport(airport, hourStart),
    getCurrentHourScores(now),
    getInboundPlanesForAirport(airport),
    getDepartingPlanesForAirport(airport),
    user ? getActiveBetsForUser(user.id) : Promise.resolve([]),
  ]);

  if (!user) {
    return (
      <main className="screen">
        <div className="screen-inner">Setting up your callsign… refresh the page.</div>
      </main>
    );
  }

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

  return (
    <AirportDashboard
      user={{ id: user.id, callsign: user.callsign, balance: user.balance }}
      airport={airport}
      initialHour={{
        hourStart: hourly.hourStart,
        hourEnd: hourly.hourEnd,
        line: hourly.line,
        sampleHours: hourly.sampleHours,
        lineSource: hourly.source,
        currentCount: scores.total_ops[airport] ?? 0,
        takeoffLine: hourlyTakeoff.line,
        takeoffSampleHours: hourlyTakeoff.sampleHours,
        takeoffLineSource: hourlyTakeoff.source,
        takeoffCount: scores.takeoff[airport] ?? 0,
      }}
      initialInbound={inbound as InboundPlane[]}
      initialDeparting={departing as DepartingPlane[]}
      initialBets={initialBets}
    />
  );
}

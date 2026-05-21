import {
  getCurrentHourScores,
  getHourlyLineForAirport,
  getInboundPlanesForAirport,
  getRecentEvents,
} from '@airport-pong/db';
import {
  AIRPORT_CODES,
  getCurrentHourStart,
  msUntilNextHour,
  type AirportCode,
} from '@airport-pong/shared';
import { getCurrentUser } from '../lib/session';
import { TopBar } from './_components/TopBar';
import { TickerTape } from './_components/Ticker';
import { AirportChooser, type ChooserCard } from './_components/AirportChooser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  const now = new Date();
  const hourStart = getCurrentHourStart(now);
  const msUntilEnd = msUntilNextHour(now);
  const locked = (60 * 60_000 - msUntilEnd) / 60_000 >= 30;
  const user = await getCurrentUser();

  const [scores, recent, ...perAirport] = await Promise.all([
    getCurrentHourScores(now),
    getRecentEvents(25),
    ...AIRPORT_CODES.map(async (code) => {
      const [line, inbound] = await Promise.all([
        getHourlyLineForAirport(code, hourStart),
        getInboundPlanesForAirport(code),
      ]);
      return { code, line, inboundCount: inbound.length };
    }),
  ]);

  const initialCards: ChooserCard[] = perAirport.map(({ code, line, inboundCount }) => ({
    airport: code as AirportCode,
    line: line.line,
    currentCount: scores.total_ops[code as AirportCode] ?? 0,
    inboundCount,
    msUntilHourEnd: msUntilEnd,
    locked,
  }));

  const initialEvents = recent.map((e) => ({
    id: e.id,
    airport: e.airport,
    eventType: e.eventType,
    callsign: e.callsign,
    typecode: e.typecode,
    isHeavy: e.isHeavy,
    occurredAt: e.occurredAt.toISOString(),
  }));

  if (!user) {
    return (
      <main className="screen">
        <div className="screen-inner">Setting up your callsign… refresh the page.</div>
      </main>
    );
  }

  return (
    <div className="app">
      <TopBar callsign={user.callsign} balance={user.balance} active="home" />
      <main className="stage stage-chooser">
        <AirportChooser initialCards={initialCards} />
      </main>
      <TickerTape events={initialEvents} />
    </div>
  );
}

import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';
import { TickerTape } from '../_components/Ticker';
import { getRecentEvents } from '@airport-pong/db';
import { BoardScreen } from './_components/BoardScreen';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function BoardPage() {
  const [user, recent] = await Promise.all([
    getCurrentUser(),
    getRecentEvents(25),
  ]);
  if (!user) {
    return (
      <main className="screen">
        <div className="screen-inner">Setting up your callsign… refresh the page.</div>
      </main>
    );
  }
  const initialEvents = recent.map((e) => ({
    id: e.id,
    airport: e.airport,
    eventType: e.eventType,
    callsign: e.callsign,
    typecode: e.typecode,
    isHeavy: e.isHeavy,
    occurredAt: e.occurredAt.toISOString(),
  }));
  return (
    <div className="app" data-route="board">
      <TopBar callsign={user.callsign} balance={user.balance} active="board" />
      <main className="screen screen-board">
        <BoardScreen userId={user.id} initialBalance={user.balance} />
      </main>
      <TickerTape events={initialEvents} />
    </div>
  );
}

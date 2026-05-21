import {
  getCurrentHourScores,
  getFeaturedFlightForAirport,
  getPaceByAirport,
} from '@airport-pong/db';
import { AIRPORT_CODES, type AirportCode } from '@airport-pong/shared';
import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';
import { ScopeCard } from '../_components/ScopeCard';
import type { LiveFlight } from '../_components/FlightTracker';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Contrail Casino · Tracker',
};

export default async function TrackerPage() {
  const [user, scores, pace, ...flights] = await Promise.all([
    getCurrentUser(),
    getCurrentHourScores(),
    getPaceByAirport(30, 'takeoff'),
    ...AIRPORT_CODES.map((c) => getFeaturedFlightForAirport(c)),
  ]);

  const live: Record<AirportCode, LiveFlight | null> = {
    JFK: null,
    ORD: null,
    ATL: null,
    LAX: null,
  };
  AIRPORT_CODES.forEach((c, i) => {
    live[c] = flights[i] ?? null;
  });

  const PAIRS: Array<[AirportCode, AirportCode]> = [
    ['JFK', 'ORD'],
    ['ATL', 'LAX'],
  ];

  return (
    <div
      style={{
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '56px 1fr',
        background: 'var(--bg-0)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <TopBar callsign={user?.callsign ?? '—'} balance={user?.balance ?? 0} active="tracker" />
      <main
        style={{
          padding: 'var(--density-pad)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 'var(--density-gap)',
          minHeight: 0,
        }}
      >
        {AIRPORT_CODES.map((code) => {
          const other = PAIRS.find((p) => p.includes(code))!.find((x) => x !== code)!;
          return (
            <ScopeCard
              key={code}
              airport={code}
              other={other}
              scores={scores}
              pace={pace[code]}
              initialFlight={live[code]}
            />
          );
        })}
      </main>
    </div>
  );
}

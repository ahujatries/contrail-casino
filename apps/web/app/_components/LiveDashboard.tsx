'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AIRPORT_CODES,
  emptyAllScores,
  getCurrentHourStart,
  type AirportCode,
  type AllScores,
} from '@airport-pong/shared';
import { TopBar } from './TopBar';
import { BetStage } from './BetStage';
import { TrackerPane } from './TrackerPane';
import { TickerTape, type TickerEvent } from './Ticker';
import { ToastStack, type Toast } from './BetResolutionToast';
import { WelcomeModal } from './WelcomeModal';
import { RefillModal } from './RefillModal';
import type { ActiveBet } from './ActiveBets';
import type { DuelLandingFlight, DuelTakeoffFlight } from '@airport-pong/db';
import type { Aircraft } from './MapTracker';

type Pace = Record<AirportCode, number>;

type Props = {
  user: { id: string; callsign: string; balance: number };
  featured: [AirportCode, AirportCode];
  initialScores: AllScores;
  initialEvents: TickerEvent[];
  initialPace: { takeoff: Pace; heavy: Pace; total: Pace };
  initialBets: ActiveBet[];
  takeoffFlights: Record<AirportCode, DuelTakeoffFlight | null>;
  landingFlights: Record<AirportCode, DuelLandingFlight | null>;
};

type IncomingEvent = {
  type: 'event';
  id: number;
  airport: string;
  eventType: 'takeoff' | 'landing';
  isHeavy: boolean;
  callsign: string | null;
  typecode: string | null;
  occurredAt: string;
};
type IncomingBetPlaced = {
  type: 'bet_placed';
  userId: string;
  bet: ActiveBet;
  newBalance: number;
};
type IncomingBetResolved = {
  type: 'bet_resolved';
  userId: string;
  betId: number;
  status: 'won' | 'lost' | 'push';
  stake: number;
  payout: number;
  label: string;
};
type SSEMessage = IncomingEvent | IncomingBetPlaced | IncomingBetResolved;

type Mode = 'takeoff' | 'landing' | 'hour';

type DashboardResp = {
  fetchedAt: string;
  freshness: { latestLiveAircraftAt: string | null; ageSec: number | null };
  airports: Record<
    string,
    {
      traffic: Aircraft[];
      takeoff: DuelTakeoffFlight | null;
      landing: DuelLandingFlight | null;
    }
  >;
};

const DASHBOARD_POLL_MS = 30_000;

export function LiveDashboard({
  user,
  featured,
  initialScores,
  initialEvents,
  initialPace,
  initialBets,
  takeoffFlights,
  landingFlights,
}: Props) {
  const [scores, setScores] = useState<AllScores>(initialScores);
  const [events, setEvents] = useState<TickerEvent[]>(initialEvents);
  const [pace, setPace] = useState(initialPace);
  const [balance, setBalance] = useState(user.balance);
  const [bets, setBets] = useState<ActiveBet[]>(initialBets);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mode, setMode] = useState<Mode>('takeoff');

  // Live data — one combined call for both featured airports
  const [liveData, setLiveData] = useState<DashboardResp | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const r = await fetch(`/api/dashboard?airports=${featured.join(',')}`, {
          cache: 'no-store',
        });
        if (!r.ok) return;
        const data = (await r.json()) as DashboardResp;
        if (!cancelled) setLiveData(data);
      } catch {
        // ignore transient errors
      }
    };
    void fetchData();
    const id = setInterval(fetchData, DASHBOARD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [featured]);

  const currentTakeoff: Record<AirportCode, DuelTakeoffFlight | null> = {
    ...takeoffFlights,
  };
  const currentLanding: Record<AirportCode, DuelLandingFlight | null> = {
    ...landingFlights,
  };
  if (liveData) {
    for (const code of featured) {
      const slice = liveData.airports[code];
      if (slice) {
        currentTakeoff[code] = slice.takeoff;
        currentLanding[code] = slice.landing;
      }
    }
  }

  const seenEventIds = useRef(new Set<number>(initialEvents.map((e) => e.id)));
  const hourStartRef = useRef(getCurrentHourStart().toISOString());
  const toastIdRef = useRef(1);

  const pushToast = (toast: Omit<Toast, 'id'>) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5_500);
  };

  useEffect(() => {
    const es = new EventSource('/api/events');

    const handleEvent = (m: IncomingEvent) => {
      if (seenEventIds.current.has(m.id)) return;
      seenEventIds.current.add(m.id);
      if (seenEventIds.current.size > 5000) {
        seenEventIds.current = new Set(Array.from(seenEventIds.current).slice(-2000));
      }
      const airport = m.airport as AirportCode;
      if (!AIRPORT_CODES.includes(airport)) return;

      const cur = getCurrentHourStart().toISOString();
      if (cur !== hourStartRef.current) {
        hourStartRef.current = cur;
        setScores(emptyAllScores());
      }

      setScores((prev) => {
        const next: AllScores = {
          takeoff: { ...prev.takeoff },
          heavy: { ...prev.heavy },
          total_ops: { ...prev.total_ops },
        };
        if (m.eventType === 'takeoff') next.takeoff[airport] += 1;
        if (m.isHeavy) next.heavy[airport] += 1;
        next.total_ops[airport] += 1;
        return next;
      });

      setPace((prev) => {
        const bump = 2;
        const next = {
          takeoff: { ...prev.takeoff },
          heavy: { ...prev.heavy },
          total: { ...prev.total },
        };
        if (m.eventType === 'takeoff') next.takeoff[airport] += bump;
        if (m.isHeavy) next.heavy[airport] += bump;
        next.total[airport] += bump;
        return next;
      });

      setEvents((prev) =>
        [
          {
            id: m.id,
            airport: m.airport,
            eventType: m.eventType,
            callsign: m.callsign,
            typecode: m.typecode ?? null,
            isHeavy: m.isHeavy,
            occurredAt: m.occurredAt,
          },
          ...prev,
        ].slice(0, 50)
      );
    };

    const handleBetResolved = (m: IncomingBetResolved) => {
      setBets((prev) =>
        prev.map((b) =>
          b.id === m.betId ? { ...b, status: m.status, resolvedAt: new Date().toISOString() } : b
        )
      );
      if (m.status === 'won') setBalance((b) => b + m.payout);
      if (m.status === 'push') setBalance((b) => b + m.stake);
      pushToast({
        kind: m.status,
        label: m.label,
        amount:
          m.status === 'won' ? m.payout - m.stake : m.status === 'push' ? m.stake : m.stake,
      });
    };

    const handleBetPlaced = (m: IncomingBetPlaced) => {
      setBets((prev) => (prev.some((b) => b.id === m.bet.id) ? prev : [m.bet, ...prev]));
      setBalance(m.newBalance);
    };

    es.onmessage = (msg) => {
      let parsed: SSEMessage;
      try {
        parsed = JSON.parse(msg.data) as SSEMessage;
      } catch {
        return;
      }
      if (parsed.type === 'event') handleEvent(parsed);
      else if (parsed.type === 'bet_resolved') handleBetResolved(parsed);
      else if (parsed.type === 'bet_placed') handleBetPlaced(parsed);
    };

    return () => es.close();
  }, []);

  const onBetPlaced = (newBalance: number) => setBalance(newBalance);
  const openBets = bets.filter((b) => b.status === 'open');

  const focusIcao24Per = (a: AirportCode): string | null => {
    if (mode === 'takeoff') return currentTakeoff[a]?.icao24 ?? null;
    if (mode === 'landing') return currentLanding[a]?.icao24 ?? null;
    return null;
  };

  return (
    <>
      <div className="app">
        <TopBar callsign={user.callsign} balance={balance} active="home" />
        <main className="stage">
          <BetStage
            a1={featured[0]}
            a2={featured[1]}
            scores={scores}
            pace={pace}
            takeoffFlights={currentTakeoff}
            landingFlights={currentLanding}
            balance={balance}
            bets={bets}
            onPlaced={onBetPlaced}
            mode={mode}
            onModeChange={setMode}
          />
          <TrackerPane
            a1={featured[0]}
            a2={featured[1]}
            mode={mode}
            traffic={{
              [featured[0]]: liveData?.airports[featured[0]]?.traffic ?? [],
              [featured[1]]: liveData?.airports[featured[1]]?.traffic ?? [],
            }}
            featuredPlanes={{
              [featured[0]]:
                mode === 'takeoff'
                  ? currentTakeoff[featured[0]]
                  : mode === 'landing'
                    ? currentLanding[featured[0]]
                    : null,
              [featured[1]]:
                mode === 'takeoff'
                  ? currentTakeoff[featured[1]]
                  : mode === 'landing'
                    ? currentLanding[featured[1]]
                    : null,
            }}
            followIcao24={{
              [featured[0]]: focusIcao24Per(featured[0]),
              [featured[1]]: focusIcao24Per(featured[1]),
            }}
            ageSec={liveData?.freshness.ageSec ?? null}
            paces={{
              [featured[0]]: pace.total[featured[0]],
              [featured[1]]: pace.total[featured[1]],
            }}
            scores={{
              [featured[0]]: {
                takeoff: scores.takeoff[featured[0]],
                landing: Math.max(0, scores.total_ops[featured[0]] - scores.takeoff[featured[0]]),
              },
              [featured[1]]: {
                takeoff: scores.takeoff[featured[1]],
                landing: Math.max(0, scores.total_ops[featured[1]] - scores.takeoff[featured[1]]),
              },
            }}
          />
        </main>
        <TickerTape events={events} />
      </div>

      <ToastStack toasts={toasts} />
      <WelcomeModal callsign={user.callsign} />
      <RefillModal open={balance <= 0 && openBets.length === 0} onRefilled={(b) => setBalance(b)} />
    </>
  );
}

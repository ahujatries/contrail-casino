'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AIRPORT_CODES,
  emptyAllScores,
  getCurrentHourStart,
  msUntilNextHour,
  type AirportCode,
  type AllScores,
} from '@airport-pong/shared';
import { TopBar } from './TopBar';
import { ScopeCard } from './ScopeCard';
import { BetMenu } from './BetMenu';
import { TickerTape, type TickerEvent } from './Ticker';
import { TotalsStrip, type TodayTotals } from './TotalsStrip';
import { ToastStack, type Toast } from './BetResolutionToast';
import { WelcomeModal } from './WelcomeModal';
import { RefillModal } from './RefillModal';
import type { ActiveBet } from './ActiveBets';
import type { LiveFlight } from './FlightTracker';

type Pace = Record<AirportCode, number>;

type Props = {
  user: { id: string; callsign: string; balance: number };
  featured: [AirportCode, AirportCode];
  initialScores: AllScores;
  initialTodayTotals: TodayTotals;
  initialEvents: TickerEvent[];
  initialPace: { takeoff: Pace; heavy: Pace; total: Pace };
  initialBets: ActiveBet[];
  liveFlights: Record<AirportCode, LiveFlight | null>;
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

export function LiveDashboard({
  user,
  featured,
  initialScores,
  initialTodayTotals,
  initialEvents,
  initialPace,
  initialBets,
  liveFlights,
}: Props) {
  const [scores, setScores] = useState<AllScores>(initialScores);
  const [todayTotals, setTodayTotals] = useState<TodayTotals>(initialTodayTotals);
  const [events, setEvents] = useState<TickerEvent[]>(initialEvents);
  const [pace, setPace] = useState(initialPace);
  const [balance, setBalance] = useState(user.balance);
  const [bets, setBets] = useState<ActiveBet[]>(initialBets);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hourLabel, setHourLabel] = useState('00:00');

  const seenEventIds = useRef(new Set<number>(initialEvents.map((e) => e.id)));
  const hourStartRef = useRef(getCurrentHourStart().toISOString());
  const toastIdRef = useRef(1);

  useEffect(() => {
    const update = () => {
      const ms = msUntilNextHour();
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');
      setHourLabel(`${mm}:${ss}`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

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

      setTodayTotals((prev) => {
        const cur = prev[airport];
        return {
          ...prev,
          [airport]: {
            takeoff: cur.takeoff + (m.eventType === 'takeoff' ? 1 : 0),
            landing: cur.landing + (m.eventType === 'landing' ? 1 : 0),
            heavy: cur.heavy + (m.isHeavy ? 1 : 0),
            total: cur.total + 1,
          },
        };
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
          b.id === m.betId
            ? { ...b, status: m.status, resolvedAt: new Date().toISOString() }
            : b
        )
      );
      if (m.status === 'won') setBalance((b) => b + m.payout);
      if (m.status === 'push') setBalance((b) => b + m.stake);
      pushToast({
        kind: m.status,
        label: m.label,
        amount:
          m.status === 'won'
            ? m.payout - m.stake
            : m.status === 'push'
              ? m.stake
              : m.stake,
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

  // Bet placement happens on per-bet pages; balance updates here via SSE bet_placed.

  const day = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getUTCDay()];
  const openBets = bets.filter((b) => b.status === 'open');

  return (
    <>
      <div className="app">
        <TopBar callsign={user.callsign} balance={balance} active="home" />

        <section className="hero">
          <div className="matchup-bar">
            <div className="matchup-title">
              <div>
                <div className="featured">{day} · DAILY MATCHUP · LIVE FLIGHTS</div>
                <h1>
                  {featured[0]}
                  <span className="vs">×</span>
                  {featured[1]}
                </h1>
              </div>
            </div>
            <div className="hour-clock">
              <span
                style={{
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontSize: 10.5,
                }}
              >
                Hour resets in
              </span>
              <span className="v">{hourLabel}</span>
            </div>
          </div>

          <div className="scopes">
            <ScopeCard
              airport={featured[0]}
              other={featured[1]}
              scores={scores}
              pace={pace.takeoff[featured[0]]}
              initialFlight={liveFlights[featured[0]]}
            />
            <ScopeCard
              airport={featured[1]}
              other={featured[0]}
              scores={scores}
              pace={pace.takeoff[featured[1]]}
              initialFlight={liveFlights[featured[1]]}
            />
          </div>
        </section>

        <BetMenu bets={bets} />

        <footer className="ticker">
          <TickerTape events={events} />
          <TotalsStrip totals={todayTotals} featured={featured} />
        </footer>
      </div>

      <ToastStack toasts={toasts} />
      <WelcomeModal callsign={user.callsign} />
      <RefillModal
        open={balance <= 0 && openBets.length === 0}
        onRefilled={(b) => setBalance(b)}
      />
    </>
  );
}

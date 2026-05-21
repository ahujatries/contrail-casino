'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AIRPORT_NAMES, type AirportCode } from '@airport-pong/shared';
import type { InboundPlane } from '@airport-pong/db';
import { TopBar } from '../../../_components/TopBar';
import { MapTracker, type Aircraft } from '../../../_components/MapTracker';
import { AtcPlayer } from '../../../_components/AtcPlayer';
import { ToastStack, type Toast } from '../../../_components/BetResolutionToast';
import { ActiveBets, type ActiveBet } from '../../../_components/ActiveBets';
import { RefillModal } from '../../../_components/RefillModal';
import { HourlyBetBox } from './HourlyBetBox';
import { InboundPlanesList } from './InboundPlanesList';
import { PlaneBetBox } from './PlaneBetBox';

const ACCENT: Record<AirportCode, string> = {
  JFK: 'oklch(0.42 0.20 258)',
  ORD: 'oklch(0.52 0.20 32)',
  ATL: 'oklch(0.50 0.13 175)',
  LAX: 'oklch(0.45 0.16 305)',
};

type HourState = {
  hourStart: string;
  hourEnd: string;
  line: number;
  sampleHours: number;
  lineSource: 'history' | 'fallback';
  currentCount: number;
  msUntilHourEnd?: number;
  locked?: boolean;
};

type AirportApiResp = {
  fetchedAt: string;
  airport: AirportCode;
  hour: HourState & { msUntilHourEnd: number; locked: boolean };
  freshness: { latestLiveAircraftAt: string | null; ageSec: number | null };
  traffic: Aircraft[];
  inbound: InboundPlane[];
};

type Props = {
  user: { id: string; callsign: string; balance: number };
  airport: AirportCode;
  initialHour: HourState;
  initialInbound: InboundPlane[];
  initialBets: ActiveBet[];
};

const POLL_MS = 30_000;

export function AirportDashboard({
  user,
  airport,
  initialHour,
  initialInbound,
  initialBets,
}: Props) {
  const accent = ACCENT[airport];
  const airportName = AIRPORT_NAMES[airport].replace(/\s*\(.*\)\s*/, '');

  const [balance, setBalance] = useState(user.balance);
  const [bets, setBets] = useState<ActiveBet[]>(initialBets);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hour, setHour] = useState<HourState & { msUntilHourEnd: number; locked: boolean }>({
    ...initialHour,
    msUntilHourEnd: 0,
    locked: false,
  });
  const [traffic, setTraffic] = useState<Aircraft[]>([]);
  const [inbound, setInbound] = useState<InboundPlane[]>(initialInbound);
  const [ageSec, setAgeSec] = useState<number | null>(null);
  const [selectedIcao24, setSelectedIcao24] = useState<string | null>(null);

  // Live polling for the per-airport endpoint
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchAll = async () => {
      try {
        const res = await fetch(`/api/airport/${airport}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as AirportApiResp;
        if (cancelled) return;
        setHour(data.hour);
        setTraffic(data.traffic);
        setInbound(data.inbound);
        setAgeSec(data.freshness.ageSec);
      } catch {
        // silent — UI shows STALE pill via ageSec drift
      }
    };

    fetchAll();
    timer = setInterval(fetchAll, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [airport]);

  // SSE for bet events (placed/resolved) — reuses existing /api/events
  const eventSourceRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    const pushToast = (t: Omit<Toast, 'id'>) =>
      setToasts((prev) => [{ ...t, id: Date.now() + Math.random() }, ...prev].slice(0, 6));

    es.onmessage = (msg) => {
      let parsed: {
        type: 'event' | 'bet_placed' | 'bet_resolved';
        userId?: string;
        bet?: ActiveBet;
        betId?: number;
        status?: 'won' | 'lost' | 'push';
        stake?: number;
        payout?: number;
        label?: string;
        newBalance?: number;
      };
      try {
        parsed = JSON.parse(msg.data);
      } catch {
        return;
      }
      if (parsed.type === 'bet_placed' && parsed.userId === user.id && parsed.bet) {
        setBets((prev) =>
          prev.some((b) => b.id === parsed.bet!.id) ? prev : [parsed.bet!, ...prev]
        );
        if (typeof parsed.newBalance === 'number') setBalance(parsed.newBalance);
      } else if (parsed.type === 'bet_resolved' && parsed.userId === user.id) {
        setBets((prev) =>
          prev.map((b) =>
            b.id === parsed.betId
              ? { ...b, status: parsed.status!, resolvedAt: new Date().toISOString() }
              : b
          )
        );
        if (parsed.status === 'won') setBalance((bal) => bal + (parsed.payout ?? 0));
        if (parsed.status === 'push') setBalance((bal) => bal + (parsed.stake ?? 0));
        pushToast({
          kind: parsed.status!,
          label: parsed.label ?? 'Bet',
          amount:
            parsed.status === 'won'
              ? (parsed.payout ?? 0) - (parsed.stake ?? 0)
              : parsed.status === 'push'
                ? parsed.stake ?? 0
                : parsed.stake ?? 0,
        });
      }
    };
    return () => es.close();
  }, [user.id]);

  const onBalanceChange = useCallback((newBal: number) => setBalance(newBal), []);

  // The plane currently selected for a plane O/U bet
  const selectedPlane = useMemo(
    () => inbound.find((p) => p.icao24 === selectedIcao24) ?? null,
    [inbound, selectedIcao24]
  );

  const openBets = bets.filter((b) => b.status === 'open');

  return (
    <>
      <div className="app">
        <TopBar callsign={user.callsign} balance={balance} active="home" />
        <main className="stage stage-airport">
          <header className="airport-head">
            <div className="airport-head-l">
              <div className="airport-code mono" style={{ color: accent }}>{airport}</div>
              <div className="airport-name mono">{airportName.toUpperCase()}</div>
            </div>
            <div className="airport-head-r mono">
              <span className="airport-pill" style={{ borderColor: accent }}>
                <span className="k">LINE</span>
                <span className="v">{hour.line}</span>
              </span>
              <span className="airport-pill">
                <span className="k">SO&nbsp;FAR</span>
                <span className="v">{hour.currentCount}</span>
              </span>
              <span className="airport-pill">
                <span className="k">FEED</span>
                <span className="v">
                  {ageSec == null ? '—' : ageSec > 60 ? `STALE ${ageSec}s` : `${ageSec}s`}
                </span>
              </span>
            </div>
          </header>

          <section className="airport-grid">
            <div className="airport-col-l">
              <HourlyBetBox
                airport={airport}
                accent={accent}
                hour={hour}
                balance={balance}
                onBalanceChange={onBalanceChange}
              />
              {selectedPlane ? (
                <PlaneBetBox
                  airport={airport}
                  accent={accent}
                  plane={selectedPlane}
                  balance={balance}
                  onBalanceChange={onBalanceChange}
                  onClose={() => setSelectedIcao24(null)}
                />
              ) : null}
              <InboundPlanesList
                planes={inbound}
                selectedIcao24={selectedIcao24}
                onSelect={setSelectedIcao24}
                accent={accent}
              />
              <ActiveBets bets={openBets} />
            </div>
            <div className="airport-col-r">
              <div className={`airport-canvas-wrap airport-${airport.toLowerCase()}`}>
                <MapTracker
                  airport={airport}
                  accent={accent}
                  aircraft={traffic}
                  followIcao24={selectedIcao24}
                  featured={
                    selectedPlane
                      ? {
                          callsign: selectedPlane.callsign,
                          typecode: selectedPlane.typecode,
                          isHeavy: selectedPlane.isHeavy,
                        }
                      : null
                  }
                  ageSec={ageSec}
                  zoom={12 /* unified — full airport + ~5nm surrounding context */}
                />
              </div>
              <AtcPlayer airport={airport} mode="landing" accent={accent} />
            </div>
          </section>
        </main>
      </div>

      <ToastStack toasts={toasts} />
      <RefillModal open={balance <= 0 && openBets.length === 0} onRefilled={(b) => setBalance(b)} />
    </>
  );
}

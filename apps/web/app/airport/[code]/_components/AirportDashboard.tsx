'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AIRPORT_NAMES, type AirportCode } from '@airport-pong/shared';
import type { DepartingPlane, InboundPlane } from '@airport-pong/db';
import { TopBar } from '../../../_components/TopBar';
import { MapTracker, type Aircraft } from '../../../_components/MapTracker';
import { AtcPlayer } from '../../../_components/AtcPlayer';
import { ToastStack, type Toast } from '../../../_components/BetResolutionToast';
import { type ActiveBet } from '../../../_components/ActiveBets';
import { RefillModal } from '../../../_components/RefillModal';
import { HourlyBetBox } from './HourlyBetBox';
import { PlaneTable } from './PlaneTable';

type HourState = {
  hourStart: string;
  hourEnd: string;
  line: number;
  sampleHours: number;
  lineSource: 'history' | 'fallback';
  currentCount: number;
  projection: number;
  overOdds: string;
  underOdds: string;
  takeoffLine: number;
  takeoffSampleHours: number;
  takeoffLineSource: 'history' | 'fallback';
  takeoffCount: number;
  takeoffProjection: number;
  takeoffOverOdds: string;
  takeoffUnderOdds: string;
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
  departing: DepartingPlane[];
};

type Props = {
  user: { id: string; callsign: string; balance: number };
  airport: AirportCode;
  initialHour: HourState;
  initialInbound: InboundPlane[];
  initialDeparting: DepartingPlane[];
  initialBets: ActiveBet[];
};

const POLL_MS = 30_000;

export function AirportDashboard({
  user,
  airport,
  initialHour,
  initialInbound,
  initialDeparting,
  initialBets,
}: Props) {
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
  const [departing, setDeparting] = useState<DepartingPlane[]>(initialDeparting);
  const [ageSec, setAgeSec] = useState<number | null>(null);
  const [selectedIcao24, setSelectedIcao24] = useState<string | null>(null);

  // Shared stake — BET 1 and BET 2 use the same value
  const [stake, setStake] = useState(100);

  // Live countdown (hydration-safe)
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => {
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const hourEndMs = new Date(hour.hourEnd).getTime();
  const msLeft = nowMs == null ? null : Math.max(0, hourEndMs - nowMs);
  const minsLeft = msLeft == null ? null : Math.floor(msLeft / 60_000);
  const secsLeft = msLeft == null ? null : Math.floor((msLeft % 60_000) / 1000);

  // Live polling
  useEffect(() => {
    let cancelled = false;
    const fetchAll = async () => {
      try {
        const res = await fetch(`/api/airport/${airport}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as AirportApiResp;
        if (cancelled) return;
        setHour(data.hour);
        setTraffic(data.traffic);
        setInbound(data.inbound);
        setDeparting(data.departing);
        setAgeSec(data.freshness.ageSec);
      } catch {
        // silent
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [airport]);

  // SSE for bet events
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
      try { parsed = JSON.parse(msg.data); } catch { return; }
      if (parsed.type === 'bet_placed' && parsed.userId === user.id && parsed.bet) {
        setBets((prev) => prev.some((b) => b.id === parsed.bet!.id) ? prev : [parsed.bet!, ...prev]);
        if (typeof parsed.newBalance === 'number') setBalance(parsed.newBalance);
      } else if (parsed.type === 'bet_resolved' && parsed.userId === user.id) {
        setBets((prev) => prev.map((b) =>
          b.id === parsed.betId ? { ...b, status: parsed.status!, resolvedAt: new Date().toISOString() } : b
        ));
        if (parsed.status === 'won') setBalance((bal) => bal + (parsed.payout ?? 0));
        if (parsed.status === 'push') setBalance((bal) => bal + (parsed.stake ?? 0));
        pushToast({
          kind: parsed.status!,
          label: parsed.label ?? 'Bet',
          amount: parsed.status === 'won'
            ? (parsed.payout ?? 0) - (parsed.stake ?? 0)
            : parsed.status === 'push' ? parsed.stake ?? 0 : parsed.stake ?? 0,
        });
      }
    };
    return () => es.close();
  }, [user.id]);

  const onBalanceChange = useCallback((newBal: number) => setBalance(newBal), []);

  // Selected plane (either inbound or departing)
  const selectedInbound = useMemo(
    () => inbound.find((p) => p.icao24 === selectedIcao24) ?? null,
    [inbound, selectedIcao24]
  );
  const selectedDeparting = useMemo(
    () => departing.find((p) => p.icao24 === selectedIcao24) ?? null,
    [departing, selectedIcao24]
  );
  const selectedAny = selectedInbound ?? selectedDeparting;

  const openBets = bets.filter((b) => b.status === 'open');

  return (
    <>
      <div className="app" data-route="airport">
        <TopBar callsign={user.callsign} balance={balance} active="home" />
        <main className="screen screen-airport-detail">
          <div className="airport-detail-grid">
            {/* LEFT — bets */}
            <div className="ad-left">
              <header className="ad-header">
                <a className="back-link mono" href="/">← All airports</a>
                <div className="ad-airport">
                  <h1 className={`ad-code apc-${airport.toLowerCase()}`}>{airport}</h1>
                  <div className="ad-city">
                    <div className="ad-city-name">{airportName.toUpperCase()}</div>
                    <div className="ad-city-meta mono">
                      UTC HOUR ·{' '}
                      {minsLeft != null
                        ? `${String(minsLeft).padStart(2, '0')}:${String(secsLeft).padStart(2, '0')} LEFT`
                        : '—'}
                      {hour.locked && ' · BETS LOCKED'}
                    </div>
                  </div>
                </div>
              </header>

              <HourlyBetBox
                airport={airport}
                hour={hour}
                stake={stake}
                setStake={setStake}
                balance={balance}
                onBalanceChange={onBalanceChange}
              />

              <PlaneTable
                airport={airport}
                inbound={inbound}
                departing={departing}
                selectedIcao24={selectedIcao24}
                onSelect={setSelectedIcao24}
                stake={stake}
                balance={balance}
                onBalanceChange={onBalanceChange}
              />

              {openBets.length > 0 && (
                <section className="ad-card">
                  <div className="ad-card-head">
                    <div className="ad-card-num mono">OPEN</div>
                    <h2 className="ad-card-title">Your bets · {openBets.length}</h2>
                  </div>
                  <ul className="ad-bets">
                    {openBets.map((b) => (
                      <li key={b.id} className="ad-bet">
                        <div className="ad-bet-l">
                          <span className="ad-bet-tag mono">{(b.betType || '').toUpperCase()}</span>
                          <span className="ad-bet-desc">
                            {summarizeBet(b)}
                          </span>
                        </div>
                        <div className="ad-bet-r mono">
                          <span className="status">● OPEN</span>
                          <span>risk ${b.stake}</span>
                          <span className="win">to win ${b.potentialPayout}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            {/* RIGHT — sticky map */}
            <aside className="ad-right">
              <div className="ad-map">
                <div className="ad-map-head">
                  <div className={`ad-map-title mono apc-${airport.toLowerCase()}`}>LIVE · {airport}</div>
                  <div className="mono ad-map-meta">
                    {inbound.length} inbound · {departing.length} departing · {traffic.length} tracked
                  </div>
                </div>
                <div className="ad-map-canvas">
                  <MapTracker
                    airport={airport}
                    accent={ACCENT[airport]}
                    aircraft={traffic}
                    followIcao24={selectedIcao24}
                    featured={selectedAny
                      ? { callsign: selectedAny.callsign, typecode: selectedAny.typecode, isHeavy: selectedAny.isHeavy }
                      : null}
                    ageSec={ageSec}
                    zoom={12}
                  />
                </div>
                <AtcPlayer airport={airport} mode="landing" accent={ACCENT[airport]} />
              </div>
            </aside>
          </div>
        </main>
      </div>

      <ToastStack toasts={toasts} />
      <RefillModal open={balance <= 0 && openBets.length === 0} onRefilled={(b) => setBalance(b)} />
    </>
  );
}

const ACCENT: Record<AirportCode, string> = {
  JFK: 'oklch(0.42 0.20 258)',
  ORD: 'oklch(0.52 0.20 32)',
  ATL: 'oklch(0.50 0.13 175)',
  LAX: 'oklch(0.45 0.16 305)',
};

function summarizeBet(b: ActiveBet): string {
  const p = b.betPayload as Record<string, unknown>;
  if (b.betType === 'race_over_under') {
    const raceLabel = p.raceType === 'takeoff' ? 'Takeoffs' : 'Total Ops';
    return `${p.airport} ${raceLabel} ${String(p.side).toUpperCase()} ${p.line}`;
  }
  if (b.betType === 'plane_landing_ou') {
    const line = p.lineMinuteIso ? new Date(p.lineMinuteIso as string).toISOString().slice(11, 16) : '';
    return `${p.callsign ?? p.icao24} · ${String(p.side).toUpperCase()} ${line} UTC landing`;
  }
  if (b.betType === 'plane_takeoff_ou') {
    const line = p.lineMinuteIso ? new Date(p.lineMinuteIso as string).toISOString().slice(11, 16) : '';
    return `${p.callsign ?? p.icao24} · ${String(p.side).toUpperCase()} ${line} UTC takeoff`;
  }
  return b.betType;
}

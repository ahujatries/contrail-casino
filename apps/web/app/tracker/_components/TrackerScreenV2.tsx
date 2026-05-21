'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AIRPORT_CODES,
  AIRPORT_NAMES,
  type AirportCode,
} from '@airport-pong/shared';
import type { DepartingPlane, InboundPlane } from '@airport-pong/db';
import { MapTracker, type Aircraft } from '../../_components/MapTracker';

const ACCENT: Record<AirportCode, string> = {
  JFK: 'oklch(0.42 0.20 258)',
  ORD: 'oklch(0.52 0.20 32)',
  ATL: 'oklch(0.50 0.13 175)',
  LAX: 'oklch(0.45 0.16 305)',
};

const POLL_MS = 30_000;

type ScoreCell = { takeoff: number; totalOps: number };
type ScoresMap = Record<'jfk' | 'ord' | 'atl' | 'lax', ScoreCell>;

type Props = {
  initialAirport: AirportCode;
  initialScores: ScoresMap;
  initialLine: number;
  initialTraffic: Aircraft[];
  initialInbound: InboundPlane[];
  initialDeparting: DepartingPlane[];
};

type Pane = 'inbound' | 'ground' | 'departing';

type FeedEvent = {
  id: number;
  ap: AirportCode;
  type: 'TAKEOFF' | 'LANDING';
  cs: string | null;
  actype: string | null;
  heavy: boolean;
  t: number;
};

type AirportApiResp = {
  hour: {
    line: number;
    currentCount: number;
  };
  traffic: Aircraft[];
  inbound: InboundPlane[];
  departing: DepartingPlane[];
  freshness: { ageSec: number | null };
};

export function TrackerScreenV2({
  initialAirport,
  initialScores,
  initialLine,
  initialTraffic,
  initialInbound,
  initialDeparting,
}: Props) {
  const [airport, setAirport] = useState<AirportCode>(initialAirport);
  const [scores, setScores] = useState<ScoresMap>(initialScores);
  const [line, setLine] = useState(initialLine);
  const [traffic, setTraffic] = useState<Aircraft[]>(initialTraffic);
  const [inbound, setInbound] = useState<InboundPlane[]>(initialInbound);
  const [departing, setDeparting] = useState<DepartingPlane[]>(initialDeparting);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [pane, setPane] = useState<Pane>('inbound');
  const [ageSec, setAgeSec] = useState<number | null>(null);

  const airportName = AIRPORT_NAMES[airport].replace(/\s*\(.*\)\s*/, '');

  // Poll the per-airport endpoint when airport changes (or every 30s)
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(`/api/airport/${airport}`, { cache: 'no-store' });
        if (!r.ok) return;
        const d = (await r.json()) as AirportApiResp;
        if (cancelled) return;
        setLine(d.hour.line);
        setTraffic(d.traffic);
        setInbound(d.inbound);
        setDeparting(d.departing);
        setAgeSec(d.freshness.ageSec);
        setScores((s) => ({
          ...s,
          [airport.toLowerCase() as keyof ScoresMap]: {
            takeoff: s[airport.toLowerCase() as keyof ScoresMap].takeoff,
            totalOps: d.hour.currentCount,
          },
        }));
      } catch {
        // silent
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [airport]);

  // SSE feed — events for this airport
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const es = new EventSource('/api/events');
    esRef.current = es;
    es.onmessage = (msg) => {
      let parsed: {
        type: 'event' | 'bet_placed' | 'bet_resolved';
        id?: number;
        airport?: string;
        eventType?: 'takeoff' | 'landing';
        callsign?: string | null;
        typecode?: string | null;
        isHeavy?: boolean;
        occurredAt?: string;
      };
      try { parsed = JSON.parse(msg.data); } catch { return; }
      if (parsed.type === 'event') {
        const ap = (parsed.airport as AirportCode);
        if (!AIRPORT_CODES.includes(ap)) return;
        const ev: FeedEvent = {
          id: parsed.id!,
          ap,
          type: parsed.eventType === 'takeoff' ? 'TAKEOFF' : 'LANDING',
          cs: parsed.callsign ?? null,
          actype: parsed.typecode ?? null,
          heavy: parsed.isHeavy ?? false,
          t: parsed.occurredAt ? Date.parse(parsed.occurredAt) : Date.now(),
        };
        setFeed((prev) => [ev, ...prev].slice(0, 50));
      }
    };
    return () => es.close();
  }, []);

  const airportFeed = useMemo(() => feed.filter((e) => e.ap === airport).slice(0, 18), [feed, airport]);

  const sFor = (key: AirportCode) => scores[key.toLowerCase() as keyof ScoresMap];
  const sNow = sFor(airport);

  // On Ground = aircraft tracked at this airport with onGround=true
  const onGroundList = useMemo(
    () => traffic.filter((a) => a.onGround).slice(0, 24),
    [traffic]
  );

  return (
    <main className="screen screen-tracker-v2">
      <div className="trk-airport-switch">
        {AIRPORT_CODES.map((a) => {
          const sc = sFor(a);
          return (
            <button
              key={a}
              className={`tas-tab airport-${a.toLowerCase()} ${airport === a ? 'on' : ''}`}
              onClick={() => setAirport(a)}
            >
              <span className="led" />
              <span className="code">{a}</span>
              <span className="name mono">
                {AIRPORT_NAMES[a].replace(/\s*\(.*\)\s*/, '').toUpperCase()}
              </span>
              <span className="num mono">{sc.totalOps}/{a === airport ? line : '—'}</span>
            </button>
          );
        })}
      </div>

      <div className="trk-body">
        {/* Map column */}
        <section className="trk-map-col">
          <div className="trk-map-head">
            <div>
              <div className="tmh-title">
                <span className={`apc apc-${airport.toLowerCase()}`}>{airport}</span>
                <span className="tmh-name mono">{airportName.toUpperCase()}</span>
              </div>
              <div className="tmh-meta mono">
                LIVE · {inbound.length} INBOUND · {departing.length} DEPARTING · {traffic.length} TRACKED
                {ageSec != null && ` · FEED ${ageSec}s`}
              </div>
            </div>
            <div className="tmh-pills">
              <span className="tmh-pill mono">
                <span className="k">LINE</span>
                <span className="v">{line}</span>
              </span>
              <span className="tmh-pill mono">
                <span className="k">OPS</span>
                <span className="v">{sNow.totalOps}</span>
              </span>
              <span className="tmh-pill mono">
                <span className="k">TO</span>
                <span className="v">{sNow.takeoff}</span>
              </span>
            </div>
          </div>
          <div className="trk-map-canvas">
            <MapTracker
              key={airport}
              airport={airport}
              accent={ACCENT[airport]}
              aircraft={traffic}
              followIcao24={null}
              featured={null}
              ageSec={ageSec}
              zoom={12}
            />
          </div>
          <div className="trk-feed">
            <div className="trk-feed-head mono">LIVE FEED · {airport}</div>
            <ul className="trk-feed-list">
              {airportFeed.length === 0 && <li className="empty mono">WAITING FOR EVENTS…</li>}
              {airportFeed.map((e) => (
                <li key={e.id} className="trk-feed-row">
                  <span className="t mono">{new Date(e.t).toISOString().slice(11, 19)}</span>
                  <span className={`ev ${e.type === 'TAKEOFF' ? 'to' : 'ldg'}`}>{e.type}</span>
                  <span className="cs">{e.cs ?? '—'}</span>
                  <span className="ac mono">{e.actype ?? '—'}</span>
                  {e.heavy && <span className="hvy mono">H</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Side panel */}
        <aside className="trk-side">
          <div className="trk-stats">
            <div className="ts-cell-v2"><div className="k mono">LINE</div><div className="v">{line}</div></div>
            <div className="ts-cell-v2"><div className="k mono">OPS</div><div className="v">{sNow.totalOps}</div></div>
            <div className="ts-cell-v2"><div className="k mono">TO</div><div className="v">{sNow.takeoff}</div></div>
            <div className="ts-cell-v2"><div className="k mono">INBND</div><div className="v">{inbound.length}</div></div>
            <div className="ts-cell-v2"><div className="k mono">GND</div><div className="v">{onGroundList.length}</div></div>
          </div>

          <div className="trk-pane-tabs">
            <button className={pane === 'inbound' ? 'on' : ''} onClick={() => setPane('inbound')}>
              Inbound · {inbound.length}
            </button>
            <button className={pane === 'ground' ? 'on' : ''} onClick={() => setPane('ground')}>
              On Ground · {onGroundList.length}
            </button>
            <button className={pane === 'departing' ? 'on' : ''} onClick={() => setPane('departing')}>
              Departing · {departing.length}
            </button>
          </div>

          <div className="trk-pane">
            {pane === 'inbound' && (
              inbound.length === 0
                ? <div className="trk-empty mono">NO BETTABLE INBOUND</div>
                : <ul className="trk-list">
                    {inbound.map((p) => (
                      <li key={p.icao24} className={`trk-row ${p.etaMin <= 10 ? 'final' : ''}`}>
                        <div className="trk-row-l">
                          <div className="cs">
                            {p.callsign ?? p.icao24.toUpperCase()}
                            {p.isHeavy && <span className="h mono">H</span>}
                          </div>
                          <div className="meta mono">{p.typecode ?? '—'} · {Math.round(p.distanceNm)}nm</div>
                        </div>
                        <div className="trk-row-r">
                          <div className="eta">{Math.round(p.etaMin)}m</div>
                          <div className="state mono">{p.etaMin <= 10 ? 'ON FINAL' : 'INBOUND'}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
            )}

            {pane === 'ground' && (
              onGroundList.length === 0
                ? <div className="trk-empty mono">NOTHING ON GROUND</div>
                : <ul className="trk-list">
                    {onGroundList.map((p) => {
                      const state =
                        p.velocityKt == null || p.velocityKt < 3 ? 'gate'
                        : p.velocityKt > 35 ? 'pushback'
                        : 'taxi';
                      return (
                        <li key={p.icao24} className="trk-row">
                          <div className="trk-row-l">
                            <div className="cs">
                              {p.callsign ?? p.icao24.toUpperCase()}
                              {p.isHeavy && <span className="h mono">H</span>}
                            </div>
                            <div className="meta mono">
                              {p.typecode ?? '—'} · {p.velocityKt ?? 0}kt
                            </div>
                          </div>
                          <div className="trk-row-r">
                            <div className={`state-pill state-${state}`}>{state.toUpperCase()}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
            )}

            {pane === 'departing' && (
              departing.length === 0
                ? <div className="trk-empty mono">NO BETTABLE DEPARTING</div>
                : <ul className="trk-list">
                    {departing.map((p) => (
                      <li key={p.icao24} className="trk-row">
                        <div className="trk-row-l">
                          <div className="cs">
                            {p.callsign ?? p.icao24.toUpperCase()}
                            {p.isHeavy && <span className="h mono">H</span>}
                          </div>
                          <div className="meta mono">
                            {p.typecode ?? '—'} · taxiing {p.velocityKt}kt
                          </div>
                        </div>
                        <div className="trk-row-r">
                          <div className="eta">{Math.round(p.ettMin)}m</div>
                          <div className="state mono">ETT</div>
                        </div>
                      </li>
                    ))}
                  </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

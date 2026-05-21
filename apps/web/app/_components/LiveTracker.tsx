'use client';

import { useEffect, useState } from 'react';
import { AIRPORT_CODES, type AirportCode } from '@airport-pong/shared';
import { RadarScope, type ScopeAircraft } from './RadarScope';

type LivePayload = {
  aircraft: Array<{
    icao24: string;
    callsign: string | null;
    typecode: string | null;
    isHeavy: boolean;
    nearestAirport: string | null;
    latitude: number | null;
    longitude: number | null;
    altitudeFt: number | null;
    velocityKt: number | null;
    headingDeg: number | null;
    verticalRateFpm: number | null;
    onGround: boolean;
    updatedAt: string;
  }>;
  fetchedAt: string;
};

type Props = {
  initial: LivePayload;
};

const POLL_MS = 15_000;

export function LiveTracker({ initial }: Props) {
  const [data, setData] = useState<LivePayload>(initial);
  const [updatedAt, setUpdatedAt] = useState(initial.fetchedAt);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' });
        if (!r.ok) return;
        const json = (await r.json()) as LivePayload;
        if (cancelled) return;
        setData(json);
        setUpdatedAt(json.fetchedAt);
      } catch {
        // ignore transient errors; next poll will try again
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const byAirport = bucketByAirport(data.aircraft);
  const sinceMs = Date.now() - new Date(updatedAt).getTime();
  const fresh = sinceMs < 30_000;

  return (
    <div className="min-h-screen bg-black text-amber-500 flex flex-col">
      <header className="border-b border-amber-500/10 px-4 md:px-6 py-2.5 flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-4 md:gap-6">
          <span className="text-amber-400 text-sm md:text-base tracking-[0.3em] font-mono">
            AIRPORT PONG
          </span>
          <span className="text-[10px] md:text-xs tracking-[0.35em] text-amber-500/60">
            TRACKER
          </span>
        </div>
        <div className="flex items-baseline gap-4 text-[10px] tracking-[0.3em] text-amber-500/40 font-mono">
          <span>
            {data.aircraft.length} <span className="text-amber-500/30">AIRCRAFT</span>
          </span>
          <span className={fresh ? 'text-amber-400' : 'text-amber-500/40'}>
            {fresh ? 'LIVE' : 'STALE'}
          </span>
          <a
            className="hidden md:inline underline hover:text-amber-400"
            href="/"
          >
            DASHBOARD
          </a>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-px bg-amber-500/5">
        {AIRPORT_CODES.map((code) => (
          <div key={code} className="bg-black">
            <RadarScope airport={code} aircraft={byAirport[code]} />
          </div>
        ))}
      </main>
    </div>
  );
}

function bucketByAirport(
  rows: LivePayload['aircraft']
): Record<AirportCode, ScopeAircraft[]> {
  const out: Record<AirportCode, ScopeAircraft[]> = {
    JFK: [],
    ORD: [],
    ATL: [],
    LAX: [],
  };
  for (const r of rows) {
    if (r.latitude == null || r.longitude == null) continue;
    const code = r.nearestAirport as AirportCode | null;
    if (!code || !AIRPORT_CODES.includes(code)) continue;
    out[code].push({
      icao24: r.icao24,
      callsign: r.callsign,
      typecode: r.typecode,
      isHeavy: r.isHeavy,
      latitude: r.latitude,
      longitude: r.longitude,
      altitudeFt: r.altitudeFt,
      velocityKt: r.velocityKt,
      headingDeg: r.headingDeg,
      onGround: r.onGround,
    });
  }
  return out;
}

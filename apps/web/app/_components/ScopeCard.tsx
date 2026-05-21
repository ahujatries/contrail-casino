'use client';

import { AIRPORT_NAMES, type AirportCode, type AllScores } from '@airport-pong/shared';
import { MapTracker } from './MapTracker';
import type { LiveFlight } from './FlightTracker';

const ACCENT: Record<AirportCode, string> = {
  JFK: 'oklch(0.80 0.15 75)',
  ORD: 'oklch(0.70 0.20 25)',
  ATL: 'oklch(0.76 0.14 170)',
  LAX: 'oklch(0.74 0.18 305)',
};

type Props = {
  airport: AirportCode;
  other: AirportCode;
  scores: AllScores;
  pace: number;
  initialFlight: LiveFlight | null;
};

export function ScopeCard({ airport, other, scores, pace, initialFlight }: Props) {
  const leading = (key: 'takeoff' | 'heavy' | 'total_ops') =>
    scores[key][airport] > scores[key][other];
  return (
    <div className={`scope-card airport-${airport.toLowerCase()}`}>
      <div className="scope-head">
        <div className="scope-id">
          <span className="airport-chip-led" />
          <span className="code">{airport}</span>
          <span className="name">{AIRPORT_NAMES[airport].replace(/\s*\(.*\)\s*/, '')}</span>
        </div>
        <div className="scope-meta">
          <div>
            <span className="k">DEPS/H</span>
            <span className="v">{Math.round(pace)}</span>
          </div>
          <div>
            <span className="k">WX</span>
            <span className="v">VFR</span>
          </div>
        </div>
      </div>

      <div className="scope-races-inline">
        <InlineRace label="TO" v={scores.takeoff[airport]} ov={scores.takeoff[other]} leading={leading('takeoff')} />
        <InlineRace label="HVY" v={scores.heavy[airport]} ov={scores.heavy[other]} leading={leading('heavy')} />
        <InlineRace label="OPS" v={scores.total_ops[airport]} ov={scores.total_ops[other]} leading={leading('total_ops')} />
      </div>

      <MapTracker airport={airport} accent={ACCENT[airport]} featured={initialFlight} />
    </div>
  );
}

function InlineRace({
  label,
  v,
  ov,
  leading,
}: {
  label: string;
  v: number;
  ov: number;
  leading: boolean;
}) {
  return (
    <div className={`inline-race${leading ? ' leading' : ''}`}>
      <span className="k">{label}</span>
      <span className="v">{v}</span>
      <span className="vs">vs</span>
      <span className="ov">{ov}</span>
    </div>
  );
}

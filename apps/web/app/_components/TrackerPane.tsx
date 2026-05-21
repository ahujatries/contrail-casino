'use client';

import { useState } from 'react';
import { MapTracker, type Aircraft } from './MapTracker';
import { AtcPlayer } from './AtcPlayer';
import { AIRPORT_NAMES, type AirportCode } from '@airport-pong/shared';

type FeaturedPlane = {
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  icao24: string;
} | null;

const ACCENT: Record<AirportCode, string> = {
  JFK: 'oklch(0.42 0.20 258)',
  ORD: 'oklch(0.52 0.20 32)',
  ATL: 'oklch(0.50 0.13 175)',
  LAX: 'oklch(0.45 0.16 305)',
};

type Props = {
  a1: AirportCode;
  a2: AirportCode;
  mode: 'takeoff' | 'landing' | 'hour';
  traffic: Partial<Record<AirportCode, Aircraft[]>>;
  featuredPlanes: Partial<Record<AirportCode, FeaturedPlane>>;
  followIcao24: Partial<Record<AirportCode, string | null>>;
  ageSec: number | null;
  paces: Partial<Record<AirportCode, number>>;
  scores: Partial<Record<AirportCode, { takeoff: number; landing: number }>>;
};

export function TrackerPane({
  a1,
  a2,
  mode,
  traffic,
  featuredPlanes,
  followIcao24,
  ageSec,
  paces,
  scores,
}: Props) {
  const [side, setSide] = useState<'a' | 'b'>('a');
  const airport = side === 'a' ? a1 : a2;
  const aircraft = traffic[airport] ?? [];
  const featured = featuredPlanes[airport] ?? null;
  const follow = followIcao24[airport] ?? null;
  const pace = paces[airport] ?? 0;
  const sc = scores[airport] ?? { takeoff: 0, landing: 0 };

  const followLabel = (() => {
    if (mode === 'hour') return 'CENTERED ON FIELD';
    if (follow && featured?.callsign) return `FOLLOW · ${featured.callsign}`;
    if (follow) return `FOLLOW · ${follow.toUpperCase()}`;
    return 'NO PLANE TO FOLLOW';
  })();

  return (
    <aside className="stage-tracker">
      <div className="trk-head">
        <div className="trk-title mono">LIVE TRACKER</div>
        <div className="trk-sub mono">{followLabel}</div>
      </div>

      <div className="trk-toggle">
        <ToggleSide
          on={side === 'a'}
          airport={a1}
          label="A"
          takeoffs={scores[a1]?.takeoff ?? 0}
          landings={scores[a1]?.landing ?? 0}
          pace={paces[a1] ?? 0}
          onClick={() => setSide('a')}
        />
        <ToggleSide
          on={side === 'b'}
          airport={a2}
          label="B"
          takeoffs={scores[a2]?.takeoff ?? 0}
          landings={scores[a2]?.landing ?? 0}
          pace={paces[a2] ?? 0}
          onClick={() => setSide('b')}
        />
      </div>

      <div className={`trk-canvas-wrap airport-${airport.toLowerCase()}`}>
        <MapTracker
          key={airport}
          airport={airport}
          accent={ACCENT[airport]}
          aircraft={aircraft}
          followIcao24={follow}
          featured={featured}
          ageSec={ageSec}
          zoom={
            mode === 'takeoff'
              ? 13 // tight on the airport — see taxiways + runways
              : mode === 'landing'
                ? 9.2 // see the ~30nm approach corridor
                : 8 // hour: wide view of the area
          }
        />
      </div>

      <AtcPlayer airport={airport} mode={mode} accent={ACCENT[airport]} />

      <div className="trk-footer mono">
        <span>{AIRPORT_NAMES[airport].replace(/\s*\(.*\)\s*/, '')}</span>
        <span className="sep">·</span>
        <span>
          <span className="k">TO</span> <span className="v">{sc.takeoff}</span>
        </span>
        <span>
          <span className="k">LDG</span> <span className="v">{sc.landing}</span>
        </span>
        <span>
          <span className="k">PACE</span> <span className="v">{Math.round(pace)}/h</span>
        </span>
        <span>
          <span className="k">TRAFFIC</span> <span className="v">{aircraft.length}</span>
        </span>
      </div>
    </aside>
  );
}

function ToggleSide({
  on,
  airport,
  label,
  takeoffs,
  landings,
  pace,
  onClick,
}: {
  on: boolean;
  airport: AirportCode;
  label: 'A' | 'B';
  takeoffs: number;
  landings: number;
  pace: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`trk-toggle-btn airport-${airport.toLowerCase()} ${on ? 'on' : ''}`}
    >
      <div className="ttb-line1">
        <span className="ttb-tag mono">{label}</span>
        <span className="ttb-code">{airport}</span>
        <span className="ttb-led" />
      </div>
      <div className="ttb-line2 mono">
        <span>{takeoffs} TO</span>
        <span>·</span>
        <span>{landings} LDG</span>
        <span>·</span>
        <span>{Math.round(pace)}/h</span>
      </div>
    </button>
  );
}

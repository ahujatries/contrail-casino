'use client';

import { MapTracker, type Aircraft } from './MapTracker';
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
  return (
    <aside className="stage-tracker">
      <div className="trk-head">
        <div className="trk-title mono">LIVE TRACKER</div>
        <div className="trk-sub mono">
          {a1} <span>·</span> {a2} <span>·</span>{' '}
          {mode === 'hour' ? 'HOUR RACE' : mode === 'takeoff' ? 'TAKEOFF' : 'LANDING'}
        </div>
      </div>
      <div className="trk-dual">
        <TrackerCell
          airport={a1}
          aircraft={traffic[a1] ?? []}
          featured={featuredPlanes[a1] ?? null}
          followIcao24={followIcao24[a1] ?? null}
          ageSec={ageSec}
          pace={paces[a1] ?? 0}
          takeoffs={scores[a1]?.takeoff ?? 0}
          landings={scores[a1]?.landing ?? 0}
          mode={mode}
        />
        <TrackerCell
          airport={a2}
          aircraft={traffic[a2] ?? []}
          featured={featuredPlanes[a2] ?? null}
          followIcao24={followIcao24[a2] ?? null}
          ageSec={ageSec}
          pace={paces[a2] ?? 0}
          takeoffs={scores[a2]?.takeoff ?? 0}
          landings={scores[a2]?.landing ?? 0}
          mode={mode}
        />
      </div>
    </aside>
  );
}

function TrackerCell({
  airport,
  aircraft,
  featured,
  followIcao24,
  ageSec,
  pace,
  takeoffs,
  landings,
  mode,
}: {
  airport: AirportCode;
  aircraft: Aircraft[];
  featured: FeaturedPlane;
  followIcao24: string | null;
  ageSec: number | null;
  pace: number;
  takeoffs: number;
  landings: number;
  mode: 'takeoff' | 'landing' | 'hour';
}) {
  const followLabel = (() => {
    if (mode === 'hour') return 'CENTERED ON FIELD';
    if (followIcao24 && featured?.callsign) return `FOLLOW · ${featured.callsign}`;
    if (followIcao24) return `FOLLOW · ${followIcao24.toUpperCase()}`;
    return 'NO PLANE TO FOLLOW';
  })();

  return (
    <div className={`trk-cell airport-${airport.toLowerCase()}`}>
      <div className="trk-cell-head">
        <div className="trk-cell-left">
          <span className="trk-cell-led" />
          <span className="trk-cell-code">{airport}</span>
          <span className="trk-cell-name">{AIRPORT_NAMES[airport].replace(/\s*\(.*\)\s*/, '')}</span>
          <span className="trk-cell-follow mono">{followLabel}</span>
        </div>
        <div className="trk-cell-right mono">
          <span>
            <span className="k">TO</span> <span className="v">{takeoffs}</span>
          </span>
          <span>
            <span className="k">LDG</span> <span className="v">{landings}</span>
          </span>
          <span>
            <span className="k">PACE</span> <span className="v">{Math.round(pace)}/h</span>
          </span>
        </div>
      </div>
      <div className="trk-cell-map">
        <MapTracker
          airport={airport}
          accent={ACCENT[airport]}
          aircraft={aircraft}
          followIcao24={followIcao24}
          featured={featured}
          ageSec={ageSec}
        />
      </div>
    </div>
  );
}

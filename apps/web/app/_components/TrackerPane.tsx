'use client';

import { MapTracker } from './MapTracker';
import { type AirportCode } from '@airport-pong/shared';

export type TrackerFlight = {
  a1: AirportCode;
  a2: AirportCode;
  aPace: number;
  bPace: number;
  aTakeoffs: number;
  bTakeoffs: number;
  aLandings: number;
  bLandings: number;
};

const ACCENT: Record<AirportCode, string> = {
  JFK: 'oklch(0.42 0.20 258)',
  ORD: 'oklch(0.52 0.20 32)',
  ATL: 'oklch(0.50 0.13 175)',
  LAX: 'oklch(0.45 0.16 305)',
};

export function TrackerPane({ flight }: { flight: TrackerFlight }) {
  // Pick the first featured airport for the map center (toggle later if needed)
  return (
    <aside className="stage-tracker">
      <div className="trk-head">
        <div className="trk-title mono">LIVE TRACKER</div>
        <div className="trk-sub mono">
          {flight.a1} <span>·</span> {flight.a2} <span>·</span> APPROACH WINDOW
        </div>
      </div>
      <div className="trk-canvas has-map" style={{ position: 'relative' }}>
        <MapTracker airport={flight.a1} accent={ACCENT[flight.a1]} featured={null} />
      </div>
      <div className="trk-foot">
        <Strip airport={flight.a1} pace={flight.aPace} takeoffs={flight.aTakeoffs} landings={flight.aLandings} />
        <Strip airport={flight.a2} pace={flight.bPace} takeoffs={flight.bTakeoffs} landings={flight.bLandings} />
      </div>
    </aside>
  );
}

function Strip({
  airport,
  pace,
  takeoffs,
  landings,
}: {
  airport: AirportCode;
  pace: number;
  takeoffs: number;
  landings: number;
}) {
  return (
    <div className={`trk-strip airport-${airport.toLowerCase()}`}>
      <div className="trk-strip-head">
        <span className="led" />
        <span className="code">{airport}</span>
      </div>
      <div className="trk-strip-row mono">
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
  );
}

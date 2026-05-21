'use client';

import { MapTracker } from './MapTracker';
import { AIRPORT_NAMES, type AirportCode } from '@airport-pong/shared';

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
  return (
    <aside className="stage-tracker">
      <div className="trk-head">
        <div className="trk-title mono">LIVE TRACKER</div>
        <div className="trk-sub mono">
          {flight.a1} <span>·</span> {flight.a2} <span>·</span> APPROACH WINDOW
        </div>
      </div>
      <div className="trk-dual">
        <TrackerCell
          airport={flight.a1}
          pace={flight.aPace}
          takeoffs={flight.aTakeoffs}
          landings={flight.aLandings}
        />
        <TrackerCell
          airport={flight.a2}
          pace={flight.bPace}
          takeoffs={flight.bTakeoffs}
          landings={flight.bLandings}
        />
      </div>
    </aside>
  );
}

function TrackerCell({
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
    <div className={`trk-cell airport-${airport.toLowerCase()}`}>
      <div className="trk-cell-head">
        <div className="trk-cell-left">
          <span className="trk-cell-led" />
          <span className="trk-cell-code">{airport}</span>
          <span className="trk-cell-name">{AIRPORT_NAMES[airport].replace(/\s*\(.*\)\s*/, '')}</span>
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
        <MapTracker airport={airport} accent={ACCENT[airport]} featured={null} />
      </div>
    </div>
  );
}

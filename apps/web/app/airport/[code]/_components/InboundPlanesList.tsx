'use client';

import { useState } from 'react';
import type { DepartingPlane, InboundPlane } from '@airport-pong/db';

type Direction = 'landing' | 'takeoff';

type Props = {
  inbound: InboundPlane[];
  departing: DepartingPlane[];
  selectedIcao24: string | null;
  onSelect: (icao: string | null, direction: Direction) => void;
  accent: string;
};

export function PlanesList({ inbound, departing, selectedIcao24, onSelect, accent }: Props) {
  const [tab, setTab] = useState<Direction>('landing');
  const list = tab === 'landing' ? inbound : departing;

  return (
    <div className="abet-card inbound">
      <div className="abet-tabs">
        <button
          type="button"
          className={`abet-tab ${tab === 'landing' ? 'on' : ''}`}
          onClick={() => setTab('landing')}
          style={tab === 'landing' ? { borderColor: accent, color: accent } : {}}
        >
          INBOUND ({inbound.length})
        </button>
        <button
          type="button"
          className={`abet-tab ${tab === 'takeoff' ? 'on' : ''}`}
          onClick={() => setTab('takeoff')}
          style={tab === 'takeoff' ? { borderColor: accent, color: accent } : {}}
        >
          DEPARTING ({departing.length})
        </button>
      </div>

      <div className="abet-head">
        <div className="abet-eyebrow mono">
          {tab === 'landing' ? 'INBOUND PLANES · PICK TO BET LANDING TIME' : 'TAXIING PLANES · PICK TO BET TAKEOFF TIME'}
        </div>
        <div className="abet-meta mono">
          {tab === 'landing'
            ? 'bets close at ETA ≤ 8 min'
            : 'bets close at ETT ≤ 4 min'}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="abet-empty mono">
          {tab === 'landing'
            ? 'No bettable inbound planes right now. Refreshing every 30s.'
            : 'No bettable taxiing planes right now. Refreshing every 30s.'}
        </div>
      ) : (
        <div className="inbound-list">
          {list.map((p) => {
            const isSel = p.icao24 === selectedIcao24;
            const etLabel = tab === 'landing'
              ? `${Math.round((p as InboundPlane).etaMin)}m`
              : `${Math.round((p as DepartingPlane).ettMin)}m`;
            const dist = tab === 'landing'
              ? `${Math.round((p as InboundPlane).distanceNm)}nm`
              : `${(p as DepartingPlane).velocityKt}kt`;
            const alt = tab === 'landing'
              ? ((p as InboundPlane).altitudeFt != null
                ? `${Math.round((p as InboundPlane).altitudeFt! / 100)}`
                : '—')
              : 'gnd';
            return (
              <button
                key={p.icao24}
                type="button"
                className={`inbound-row ${isSel ? 'on' : ''}`}
                onClick={() => onSelect(isSel ? null : p.icao24, tab)}
                style={isSel ? { borderColor: accent } : {}}
              >
                <span className="inb-cs mono">{p.callsign ?? p.icao24.toUpperCase()}</span>
                <span className="inb-tc mono">
                  {p.typecode ?? '—'}
                  {p.isHeavy ? ' ·H' : ''}
                </span>
                <span className="inb-eta mono" style={isSel ? { color: accent } : {}}>
                  {etLabel}
                </span>
                <span className="inb-dist mono">{dist}</span>
                <span className="inb-alt mono">{alt}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

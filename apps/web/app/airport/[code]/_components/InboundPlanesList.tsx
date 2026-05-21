'use client';

import type { InboundPlane } from '@airport-pong/db';

type Props = {
  planes: InboundPlane[];
  selectedIcao24: string | null;
  onSelect: (icao: string | null) => void;
  accent: string;
};

export function InboundPlanesList({ planes, selectedIcao24, onSelect, accent }: Props) {
  return (
    <div className="abet-card inbound">
      <div className="abet-head">
        <div className="abet-eyebrow mono">INBOUND PLANES · PICK TO BET</div>
        <div className="abet-meta mono">{planes.length} approaching</div>
      </div>
      {planes.length === 0 ? (
        <div className="abet-empty mono">
          No inbound planes within ~80nm. Refreshing every 30s.
        </div>
      ) : (
        <div className="inbound-list">
          {planes.map((p) => {
            const isSel = p.icao24 === selectedIcao24;
            const etaLabel = `${Math.round(p.etaMin)}m`;
            return (
              <button
                key={p.icao24}
                type="button"
                className={`inbound-row ${isSel ? 'on' : ''}`}
                onClick={() => onSelect(isSel ? null : p.icao24)}
                style={isSel ? { borderColor: accent } : {}}
              >
                <span className="inb-cs mono">{p.callsign ?? p.icao24.toUpperCase()}</span>
                <span className="inb-tc mono">
                  {p.typecode ?? '—'}
                  {p.isHeavy ? ' ·H' : ''}
                </span>
                <span className="inb-eta mono" style={isSel ? { color: accent } : {}}>
                  {etaLabel}
                </span>
                <span className="inb-dist mono">{Math.round(p.distanceNm)}nm</span>
                <span className="inb-alt mono">
                  {p.altitudeFt != null ? `${Math.round(p.altitudeFt / 100)}` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

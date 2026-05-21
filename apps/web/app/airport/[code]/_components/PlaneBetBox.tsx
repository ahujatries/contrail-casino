'use client';

import { useMemo, useState, useTransition } from 'react';
import type { AirportCode } from '@airport-pong/shared';
import type { InboundPlane } from '@airport-pong/db';
import { placeBet } from '../../../actions/place-bet';

type Props = {
  airport: AirportCode;
  accent: string;
  plane: InboundPlane;
  balance: number;
  onBalanceChange: (newBal: number) => void;
  onClose: () => void;
};

const STAKE_PRESETS = [25, 100, 500];

/**
 * Plane landing O/U. System suggests the ETA as the line; user picks
 * over/under. The line is "lands at HH:MM UTC"; under = lands strictly
 * before, over = lands strictly after. Within ±30s → push.
 */
export function PlaneBetBox({
  airport,
  accent,
  plane,
  balance,
  onBalanceChange,
  onClose,
}: Props) {
  const [side, setSide] = useState<'over' | 'under' | null>(null);
  const [stake, setStake] = useState(100);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Snap the line to the start of the projected landing minute
  const { lineMinuteIso, lineLabel } = useMemo(() => {
    const eta = new Date(plane.expectedLandingAt);
    const snapped = new Date(eta);
    snapped.setUTCSeconds(0, 0);
    return {
      lineMinuteIso: snapped.toISOString(),
      lineLabel: snapped.toISOString().slice(11, 16),
    };
  }, [plane.expectedLandingAt]);

  const place = () => {
    if (!side) return setError('Pick OVER or UNDER first');
    if (stake <= 0 || stake > balance) return setError('Bad stake');
    setError(null);
    startTransition(async () => {
      const res = await placeBet({
        type: 'plane_landing_ou',
        payload: {
          airport,
          icao24: plane.icao24,
          callsign: plane.callsign,
          typecode: plane.typecode,
          lineMinuteIso,
          side,
          etaMinAtPlacement: plane.etaMin,
          placedAt: new Date().toISOString(),
        },
        stake,
      });
      if ('ok' in res && res.ok) {
        onBalanceChange(res.newBalance);
        onClose();
      } else if ('error' in res) {
        setError(res.error ?? 'Bet failed');
      }
    });
  };

  return (
    <div className="abet-card plane" style={{ borderColor: accent }}>
      <div className="abet-head">
        <div>
          <div className="abet-eyebrow mono" style={{ color: accent }}>
            PLANE LANDING O/U · {plane.callsign ?? plane.icao24.toUpperCase()}
          </div>
          <div className="abet-meta mono">
            {plane.typecode ?? '—'}
            {plane.isHeavy ? ' ·H' : ''}
            <span className="sep">·</span>
            {Math.round(plane.distanceNm)}nm out
            <span className="sep">·</span>
            {plane.altitudeFt != null ? `${plane.altitudeFt}ft` : '—'}
            <span className="sep">·</span>
            {plane.velocityKt}kt
          </div>
        </div>
        <button type="button" className="abet-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="abet-line-row">
        <div className="abet-line-block big">
          <div className="k mono">SUGGESTED LINE</div>
          <div className="v line-big">{lineLabel}</div>
          <div className="line-sub mono">UTC · ETA {Math.round(plane.etaMin)}m</div>
        </div>
      </div>

      <div className="abet-sides">
        <button
          type="button"
          className={`abet-side under ${side === 'under' ? 'on' : ''}`}
          onClick={() => setSide('under')}
          style={side === 'under' ? { borderColor: accent, background: accent, color: 'white' } : {}}
          title="Plane lands before this minute"
        >
          <span className="abet-side-tag mono">UNDER</span>
          <span className="abet-side-line">lands before {lineLabel}</span>
        </button>
        <button
          type="button"
          className={`abet-side over ${side === 'over' ? 'on' : ''}`}
          onClick={() => setSide('over')}
          style={side === 'over' ? { borderColor: accent, background: accent, color: 'white' } : {}}
          title="Plane lands after this minute"
        >
          <span className="abet-side-tag mono">OVER</span>
          <span className="abet-side-line">lands after {lineLabel}</span>
        </button>
      </div>

      <div className="abet-stake-row">
        <div className="abet-stake-presets">
          {STAKE_PRESETS.map((s) => (
            <button
              key={s}
              type="button"
              className={`abet-stake-chip ${stake === s ? 'on' : ''}`}
              onClick={() => setStake(s)}
            >
              ${s}
            </button>
          ))}
        </div>
        <input
          type="number"
          min={1}
          max={balance}
          value={stake}
          onChange={(e) => setStake(Math.max(0, parseInt(e.target.value || '0', 10)))}
          className="abet-stake-input mono"
        />
      </div>

      <button
        type="button"
        className="abet-place"
        disabled={pending || !side || stake <= 0 || stake > balance}
        onClick={place}
        style={{ background: accent }}
      >
        {pending ? 'PLACING…' : `PLACE ${side ? side.toUpperCase() : ''} $${stake}`.trim()}
      </button>

      {error && <div className="abet-msg err mono">{error}</div>}
    </div>
  );
}

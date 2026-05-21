'use client';

import { useMemo, useState, useTransition } from 'react';
import type { AirportCode } from '@airport-pong/shared';
import type { DepartingPlane, InboundPlane } from '@airport-pong/db';
import { placeBet } from '../../../actions/place-bet';

type Direction = 'landing' | 'takeoff';

type Props = {
  airport: AirportCode;
  accent: string;
  direction: Direction;
  plane: InboundPlane | DepartingPlane;
  balance: number;
  onBalanceChange: (newBal: number) => void;
  onClose: () => void;
};

const STAKE_PRESETS = [25, 100, 500];

/**
 * Per-plane landing/takeoff O/U. System suggests ETA (or ETT for taxiing
 * planes) as the line; user picks over/under. The line is snapped to the
 * start of the projected minute; ±30s of the line → push.
 */
export function PlaneBetBox({
  airport,
  accent,
  direction,
  plane,
  balance,
  onBalanceChange,
  onClose,
}: Props) {
  const [side, setSide] = useState<'over' | 'under' | null>(null);
  const [stake, setStake] = useState(100);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLanding = direction === 'landing';

  // Extract the per-direction values
  const eventEtaMin = isLanding
    ? (plane as InboundPlane).etaMin
    : (plane as DepartingPlane).ettMin;
  const eventTimeIso = isLanding
    ? (plane as InboundPlane).expectedLandingAt
    : (plane as DepartingPlane).expectedTakeoffAt;

  // Snap line to start of the projected minute
  const { lineMinuteIso, lineLabel } = useMemo(() => {
    const t = new Date(eventTimeIso);
    const snapped = new Date(t);
    snapped.setUTCSeconds(0, 0);
    return {
      lineMinuteIso: snapped.toISOString(),
      lineLabel: snapped.toISOString().slice(11, 16),
    };
  }, [eventTimeIso]);

  const place = () => {
    if (!side) return setError('Pick OVER or UNDER first');
    if (stake <= 0 || stake > balance) return setError('Bad stake');
    setError(null);
    startTransition(async () => {
      const payload = isLanding
        ? {
            airport,
            icao24: plane.icao24,
            callsign: plane.callsign,
            typecode: plane.typecode,
            lineMinuteIso,
            side,
            etaMinAtPlacement: eventEtaMin,
            placedAt: new Date().toISOString(),
          }
        : {
            airport,
            icao24: plane.icao24,
            callsign: plane.callsign,
            typecode: plane.typecode,
            lineMinuteIso,
            side,
            ettMinAtPlacement: eventEtaMin,
            placedAt: new Date().toISOString(),
          };
      const res = await placeBet({
        type: isLanding ? 'plane_landing_ou' : 'plane_takeoff_ou',
        payload,
        stake,
      } as Parameters<typeof placeBet>[0]);
      if ('ok' in res && res.ok) {
        onBalanceChange(res.newBalance);
        onClose();
      } else if ('error' in res) {
        setError(res.error ?? 'Bet failed');
      }
    });
  };

  // Per-direction labels + context
  const eyebrow = isLanding ? 'PLANE LANDING O/U' : 'PLANE TAKEOFF O/U';
  const eventVerb = isLanding ? 'lands' : 'takes off';
  const lineSubtitle = isLanding
    ? `UTC · ETA ${Math.round(eventEtaMin)}m`
    : `UTC · ETT ${Math.round(eventEtaMin)}m`;
  const metaParts: string[] = [];
  if (plane.typecode) metaParts.push(plane.typecode + (plane.isHeavy ? ' ·H' : ''));
  if (isLanding) {
    metaParts.push(`${Math.round((plane as InboundPlane).distanceNm)}nm out`);
    if ((plane as InboundPlane).altitudeFt != null)
      metaParts.push(`${(plane as InboundPlane).altitudeFt}ft`);
    metaParts.push(`${(plane as InboundPlane).velocityKt}kt`);
  } else {
    metaParts.push(`taxiing ${(plane as DepartingPlane).velocityKt}kt`);
  }

  return (
    <div className="abet-card plane" style={{ borderColor: accent }}>
      <div className="abet-head">
        <div>
          <div className="abet-eyebrow mono" style={{ color: accent }}>
            {eyebrow} · {plane.callsign ?? plane.icao24.toUpperCase()}
          </div>
          <div className="abet-meta mono">
            {metaParts.map((p, i) => (
              <span key={i}>
                {p}
                {i < metaParts.length - 1 && <span className="sep">·</span>}
              </span>
            ))}
          </div>
        </div>
        <button type="button" className="abet-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="abet-line-row">
        <div className="abet-line-block big">
          <div className="k mono">SUGGESTED LINE</div>
          <div className="v line-big">{lineLabel}</div>
          <div className="line-sub mono">{lineSubtitle}</div>
        </div>
      </div>

      <div className="abet-sides">
        <button
          type="button"
          className={`abet-side under ${side === 'under' ? 'on' : ''}`}
          onClick={() => setSide('under')}
          style={side === 'under' ? { borderColor: accent, background: accent, color: 'white' } : {}}
          title={`Plane ${eventVerb} before this minute`}
        >
          <span className="abet-side-tag mono">UNDER</span>
          <span className="abet-side-line">{eventVerb} before {lineLabel}</span>
        </button>
        <button
          type="button"
          className={`abet-side over ${side === 'over' ? 'on' : ''}`}
          onClick={() => setSide('over')}
          style={side === 'over' ? { borderColor: accent, background: accent, color: 'white' } : {}}
          title={`Plane ${eventVerb} after this minute`}
        >
          <span className="abet-side-tag mono">OVER</span>
          <span className="abet-side-line">{eventVerb} after {lineLabel}</span>
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

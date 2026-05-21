'use client';

import { useEffect, useState, useTransition } from 'react';
import type { AirportCode, RaceType } from '@airport-pong/shared';
import { placeBet } from '../../../actions/place-bet';

type Hour = {
  hourStart: string;
  hourEnd: string;
  line: number;
  sampleHours: number;
  lineSource: 'history' | 'fallback';
  currentCount: number;
  takeoffLine: number;
  takeoffSampleHours: number;
  takeoffLineSource: 'history' | 'fallback';
  takeoffCount: number;
  msUntilHourEnd: number;
  locked: boolean;
};

type Tab = 'total_ops' | 'takeoff';

type Props = {
  airport: AirportCode;
  accent: string;
  hour: Hour;
  balance: number;
  onBalanceChange: (newBal: number) => void;
};

const STAKE_PRESETS = [25, 100, 500];

export function HourlyBetBox({ airport, accent, hour, balance, onBalanceChange }: Props) {
  const [tab, setTab] = useState<Tab>('total_ops');
  const [side, setSide] = useState<'over' | 'under' | null>(null);
  const [stake, setStake] = useState(100);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reset bet form when switching tabs
  useEffect(() => {
    setSide(null);
    setError(null);
    setSuccess(null);
  }, [tab]);

  // Hour countdown — defer to client to avoid hydration mismatch
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const hourEndMs = new Date(hour.hourEnd).getTime();
  const msLeft = now == null ? null : Math.max(0, hourEndMs - now);
  const minsLeft = msLeft == null ? null : Math.floor(msLeft / 60_000);
  const secsLeft = msLeft == null ? null : Math.floor((msLeft % 60_000) / 1000);

  // Tab-specific values
  const line = tab === 'total_ops' ? hour.line : hour.takeoffLine;
  const currentCount = tab === 'total_ops' ? hour.currentCount : hour.takeoffCount;
  const lineSource = tab === 'total_ops' ? hour.lineSource : hour.takeoffLineSource;

  const place = () => {
    if (!side) return setError('Pick OVER or UNDER first');
    if (stake <= 0 || stake > balance) return setError('Bad stake');
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await placeBet({
        type: 'race_over_under',
        payload: {
          raceType: tab as RaceType,
          airport,
          line,
          side,
          hourStart: hour.hourStart,
        },
        stake,
      });
      if ('ok' in res && res.ok) {
        onBalanceChange(res.newBalance);
        setSuccess(`Bet placed: ${side.toUpperCase()} ${line} ${tab === 'takeoff' ? 'takeoffs' : 'ops'}`);
        setSide(null);
      } else if ('error' in res) {
        setError(res.error ?? 'Bet failed');
      }
    });
  };

  const hourLabel = new Date(hour.hourStart).toISOString().slice(11, 16);
  const hourEndLabel = new Date(hour.hourEnd).toISOString().slice(11, 16);
  const pace =
    minsLeft != null && minsLeft < 60
      ? Math.round((currentCount / Math.max(1, 60 - minsLeft)) * 60)
      : currentCount;
  const projection = pace;

  return (
    <div className="abet-card hourly">
      <div className="abet-tabs">
        <button
          type="button"
          className={`abet-tab ${tab === 'total_ops' ? 'on' : ''}`}
          onClick={() => setTab('total_ops')}
          style={tab === 'total_ops' ? { borderColor: accent, color: accent } : {}}
        >
          TOTAL OPS
        </button>
        <button
          type="button"
          className={`abet-tab ${tab === 'takeoff' ? 'on' : ''}`}
          onClick={() => setTab('takeoff')}
          style={tab === 'takeoff' ? { borderColor: accent, color: accent } : {}}
        >
          TAKEOFFS
        </button>
      </div>

      <div className="abet-head">
        <div className="abet-eyebrow mono">
          HOURLY OVER/UNDER · {tab === 'takeoff' ? 'TAKEOFFS ONLY' : 'TAKEOFFS + LANDINGS'}
        </div>
        <div className="abet-meta mono">
          {hourLabel}–{hourEndLabel} UTC
          {minsLeft != null && (
            <>
              <span className="sep">·</span>
              <span className={hour.locked || (minsLeft <= 5) ? 'urgent' : ''}>
                {minsLeft}m {String(secsLeft).padStart(2, '0')}s left
              </span>
            </>
          )}
          {lineSource === 'fallback' && (
            <>
              <span className="sep">·</span>
              <span className="note">line: fallback (thin history)</span>
            </>
          )}
        </div>
      </div>

      <div className="abet-line-row">
        <div className="abet-line-block">
          <div className="k mono">LINE</div>
          <div className="v line-big">{line}</div>
        </div>
        <div className="abet-line-block">
          <div className="k mono">SO FAR</div>
          <div className="v">{currentCount}</div>
        </div>
        <div className="abet-line-block">
          <div className="k mono">PROJ</div>
          <div className="v" title="Linear projection from current pace">
            {projection}
          </div>
        </div>
      </div>

      {hour.locked ? (
        <div className="abet-locked mono">
          BETS LOCKED · HALF HOUR REMAINING
          <div className="abet-locked-sub">Settles at top of next hour</div>
        </div>
      ) : (
        <>
          <div className="abet-sides">
            <button
              type="button"
              className={`abet-side over ${side === 'over' ? 'on' : ''}`}
              onClick={() => setSide('over')}
              style={side === 'over' ? { borderColor: accent, background: accent, color: 'white' } : {}}
            >
              <span className="abet-side-tag mono">OVER</span>
              <span className="abet-side-line">{line}</span>
            </button>
            <button
              type="button"
              className={`abet-side under ${side === 'under' ? 'on' : ''}`}
              onClick={() => setSide('under')}
              style={side === 'under' ? { borderColor: accent, background: accent, color: 'white' } : {}}
            >
              <span className="abet-side-tag mono">UNDER</span>
              <span className="abet-side-line">{line}</span>
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
            {pending ? 'PLACING…' : `PLACE ${side ? side.toUpperCase() : ''} ${stake ? `$${stake}` : ''}`.trim()}
          </button>
        </>
      )}

      {error && <div className="abet-msg err mono">{error}</div>}
      {success && <div className="abet-msg ok mono">{success}</div>}
    </div>
  );
}

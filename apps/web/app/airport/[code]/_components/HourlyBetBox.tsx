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
  projection: number;
  overOdds: string;
  underOdds: string;
  takeoffLine: number;
  takeoffSampleHours: number;
  takeoffLineSource: 'history' | 'fallback';
  takeoffCount: number;
  takeoffProjection: number;
  takeoffOverOdds: string;
  takeoffUnderOdds: string;
  msUntilHourEnd: number;
  locked: boolean;
};

type Market = 'total_ops' | 'takeoff';

type Props = {
  airport: AirportCode;
  hour: Hour;
  stake: number;
  setStake: (n: number) => void;
  balance: number;
  onBalanceChange: (newBal: number) => void;
};

const STAKE_PRESETS = [25, 50, 100, 250, 500];
const MIN_STAKE = 10;
const MAX_STAKE = 1000;

export function HourlyBetBox({ airport, hour, stake, setStake, balance, onBalanceChange }: Props) {
  const [market, setMarket] = useState<Market>('total_ops');
  const [side, setSide] = useState<'over' | 'under' | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Reset side on market switch
  useEffect(() => {
    setSide(null);
    setError(null);
  }, [market]);

  const line = market === 'total_ops' ? hour.line : hour.takeoffLine;
  const currentCount = market === 'total_ops' ? hour.currentCount : hour.takeoffCount;
  const projection = market === 'total_ops' ? hour.projection : hour.takeoffProjection;
  const overOdds = market === 'total_ops' ? hour.overOdds : hour.takeoffOverOdds;
  const underOdds = market === 'total_ops' ? hour.underOdds : hour.takeoffUnderOdds;
  const lineSource = market === 'total_ops' ? hour.lineSource : hour.takeoffLineSource;
  const minsLeft = Math.max(0, Math.floor(hour.msUntilHourEnd / 60_000));

  // Multiplier from selected side's American odds
  const selectedOdds = side === 'over' ? overOdds : side === 'under' ? underOdds : null;
  const dec = selectedOdds == null ? 0 : americanToDecimal(selectedOdds);
  const profit = selectedOdds == null ? 0 : Math.round(stake * dec - stake);

  const place = () => {
    if (!side) return setError('Pick OVER or UNDER first');
    if (stake < MIN_STAKE) return setError(`Min stake $${MIN_STAKE}`);
    if (stake > MAX_STAKE) return setError(`Max stake $${MAX_STAKE}`);
    if (stake > balance) return setError('Insufficient balance');
    setError(null);
    startTransition(async () => {
      const res = await placeBet({
        type: 'race_over_under',
        payload: {
          raceType: market as RaceType,
          airport,
          line,
          side,
          hourStart: hour.hourStart,
        },
        stake,
      });
      if ('ok' in res && res.ok) {
        onBalanceChange(res.newBalance);
        setSide(null);
      } else if ('error' in res) {
        setError(res.error ?? 'Bet failed');
      }
    });
  };

  return (
    <section className="ad-card">
      <div className="ad-card-head">
        <div className="ad-card-num mono">BET 1</div>
        <h2 className="ad-card-title">This hour&rsquo;s over/under</h2>
        <div className="ad-card-tabs">
          <button className={market === 'total_ops' ? 'on' : ''} onClick={() => setMarket('total_ops')}>
            Total ops
          </button>
          <button className={market === 'takeoff' ? 'on' : ''} onClick={() => setMarket('takeoff')}>
            Takeoffs only
          </button>
        </div>
      </div>

      <div className="ou-scoreboard">
        <div className="ou-cell">
          <div className="k mono">LINE</div>
          <div className="v big">{line}</div>
        </div>
        <div className="ou-cell">
          <div className="k mono">SO FAR</div>
          <div className="v">{currentCount}</div>
        </div>
        <div className="ou-cell">
          <div className="k mono">PROJECTED</div>
          <div className={`v ${projection > line ? 'over' : 'under'}`}>{projection}</div>
        </div>
        <div className="ou-cell">
          <div className="k mono">TIME LEFT</div>
          <div className="v mono">{minsLeft}m</div>
        </div>
      </div>

      {hour.locked ? (
        <div className="plane-empty mono">
          BETS LOCKED · LESS THAN 30 MIN REMAINING · SETTLES AT TOP OF NEXT HOUR
        </div>
      ) : (
        <>
          <div className="ou-picks">
            <button
              type="button"
              className={`ou-pick over ${side === 'over' ? 'on' : ''}`}
              onClick={() => setSide('over')}
            >
              <div className="ou-pick-lbl">Over</div>
              <div className="ou-pick-v">{line}</div>
              <div className="ou-pick-odds mono">{overOdds}</div>
              <div className="ou-pick-hint mono">
                {projection > line ? 'PROJ FAVORS' : 'LONGER ODDS'}
              </div>
            </button>
            <button
              type="button"
              className={`ou-pick under ${side === 'under' ? 'on' : ''}`}
              onClick={() => setSide('under')}
            >
              <div className="ou-pick-lbl">Under</div>
              <div className="ou-pick-v">{line}</div>
              <div className="ou-pick-odds mono">{underOdds}</div>
              <div className="ou-pick-hint mono">
                {projection < line ? 'PROJ FAVORS' : 'LONGER ODDS'}
              </div>
            </button>
          </div>

          <div className="ou-stake">
            <div className="ou-stake-l">
              <div className="k mono">YOUR STAKE</div>
              <div className="ou-chips">
                {STAKE_PRESETS.map((v) => (
                  <button key={v} className={stake === v ? 'on' : ''} onClick={() => setStake(v)}>
                    {v}
                  </button>
                ))}
              </div>
              <div className="ou-stake-input">
                <span className="g">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={stake}
                  onChange={(e) => {
                    const n = parseInt(String(e.target.value).replace(/[^\d]/g, ''), 10);
                    setStake(Number.isNaN(n) ? 0 : Math.min(MAX_STAKE, Math.max(0, n)));
                  }}
                />
              </div>
            </div>
            <div className="ou-stake-r">
              <div className="k mono">YOU WIN</div>
              <div className="ou-win">${profit.toLocaleString()}</div>
              <div className="ou-mult mono">
                {selectedOdds ? `${dec.toFixed(2)}x · ${selectedOdds}` : 'PICK A SIDE'}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="ou-place"
            disabled={pending || !side || stake < MIN_STAKE || stake > balance}
            onClick={place}
          >
            {pending ? 'Placing…' : side
              ? `Place $${stake} · ${airport} ${market === 'total_ops' ? 'Total' : 'Takeoffs'} ${side.toUpperCase()} ${line} →`
              : '↑ First, pick OVER or UNDER above'}
          </button>

          {lineSource === 'fallback' && (
            <div className="ad-card-explainer mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.10em' }}>
              LINE: FALLBACK (THIN HISTORY) · WILL TIGHTEN AS DATA ACCUMULATES
            </div>
          )}
          {error && <div className="ad-card-explainer" style={{ color: 'var(--neg)' }}>{error}</div>}
        </>
      )}
    </section>
  );
}

function americanToDecimal(american: string): number {
  const n = parseInt(american, 10);
  if (Number.isNaN(n)) return 1;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  AIRPORT_CODES,
  MAX_BET,
  MIN_BET,
  describeBet,
  getCurrentHourStart,
  msUntilNextHour,
  nextEventOdds,
  raceOverUnderOdds,
  raceWinnerOdds,
  suggestedLineForHour,
  type AirportCode,
  type AllScores,
  type BetPayloadByType,
  type BetTypeKey,
  type RaceType,
} from '@airport-pong/shared';
import { placeBet, type PlaceBetResult } from '../actions/place-bet';
import type { ActiveBet } from './ActiveBets';

type Pace = Record<AirportCode, number>;

type Props = {
  scores: AllScores;
  pace: { takeoff: Pace; heavy: Pace; total: Pace };
  balance: number;
  bets: ActiveBet[];
  onPlaced?: (newBalance: number) => void;
};

type UIBetType = 'takeoff' | 'heavy' | 'ou10' | 'streak' | 'race' | 'raceou' | 'margin';

const BET_BUTTONS: Array<{ id: UIBetType; label: string; live: boolean }> = [
  { id: 'takeoff', label: 'Next Takeoff', live: true },
  { id: 'heavy', label: 'Next Heavy', live: true },
  { id: 'ou10', label: '10-Min O/U', live: false },
  { id: 'streak', label: 'Streak', live: false },
  { id: 'race', label: 'Race Winner', live: true },
  { id: 'raceou', label: 'Race O/U', live: true },
  { id: 'margin', label: 'Margin', live: false },
];

const RACE_LABEL_SHORT: Record<RaceType, string> = {
  takeoff: 'Takeoff',
  heavy: 'Heavy',
  total_ops: 'Total Ops',
};

const fmtMoney = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtAmerican = (a: number) => (a > 0 ? `+${a}` : `${a}`);
const decimalToAmerican = (d: number): number => {
  if (d >= 2) return Math.round((d - 1) * 100);
  return Math.round(-100 / (d - 1));
};

const lc = (a: AirportCode) => a.toLowerCase();

export function BetPanel({ scores, pace, balance, bets, onPlaced }: Props) {
  const [betType, setBetType] = useState<UIBetType>('takeoff');
  const [pickedAirport, setPickedAirport] = useState<AirportCode>('JFK');
  const [pickedSide, setPickedSide] = useState<'over' | 'under'>('over');
  const [pickedRace, setPickedRace] = useState<RaceType>('takeoff');
  const [stake, setStake] = useState(100);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [, startTransition] = useTransition();
  const [pending, setPending] = useState(false);

  const hourStart = getCurrentHourStart().toISOString();
  const minutesRemaining = Math.max(1, Math.round(msUntilNextHour() / 60_000));
  const paceForRace = pickedRace === 'takeoff' ? pace.takeoff : pickedRace === 'heavy' ? pace.heavy : pace.total;

  const takeoffOdds = useMemo(() => nextEventOdds(pace.takeoff), [pace.takeoff]);
  const heavyOdds = useMemo(() => nextEventOdds(pace.heavy), [pace.heavy]);
  const raceWinOdds = useMemo(
    () =>
      raceWinnerOdds({
        currentScores: scores[pickedRace],
        paceByAirport: paceForRace,
        minutesRemaining,
      }),
    [scores, paceForRace, minutesRemaining, pickedRace]
  );
  const suggestedLine = suggestedLineForHour(
    scores[pickedRace][pickedAirport],
    paceForRace[pickedAirport],
    minutesRemaining
  );
  const ouOdds = useMemo(
    () =>
      raceOverUnderOdds({
        currentScore: scores[pickedRace][pickedAirport],
        pace: paceForRace[pickedAirport],
        minutesRemaining,
        line: suggestedLine,
      }),
    [scores, paceForRace, pickedRace, pickedAirport, minutesRemaining, suggestedLine]
  );

  const currentDecimal = (() => {
    if (betType === 'takeoff') return takeoffOdds[pickedAirport].decimal;
    if (betType === 'heavy') return heavyOdds[pickedAirport].decimal;
    if (betType === 'race') return raceWinOdds[pickedAirport].decimal;
    if (betType === 'raceou') return (pickedSide === 'over' ? ouOdds.over : ouOdds.under).decimal;
    return 2.0; // placeholder for disabled types
  })();
  const profit = Math.round(stake * currentDecimal) - stake;
  const currentAmerican = decimalToAmerican(currentDecimal);

  const submit = () => {
    if (stake < MIN_BET || stake > MAX_BET) {
      setFlash({ kind: 'err', msg: `Stake must be $${MIN_BET}–$${MAX_BET}` });
      return;
    }
    if (stake > balance) {
      setFlash({ kind: 'err', msg: 'Stake exceeds balance' });
      return;
    }

    let payload: { type: BetTypeKey; data: BetPayloadByType[BetTypeKey] };
    if (betType === 'takeoff') {
      payload = { type: 'next_event', data: { airport: pickedAirport } };
    } else if (betType === 'heavy') {
      payload = { type: 'next_heavy', data: { airport: pickedAirport } };
    } else if (betType === 'race') {
      payload = {
        type: 'race_winner',
        data: { airport: pickedAirport, raceType: pickedRace, hourStart },
      };
    } else if (betType === 'raceou') {
      payload = {
        type: 'race_over_under',
        data: {
          airport: pickedAirport,
          raceType: pickedRace,
          line: suggestedLine,
          side: pickedSide,
          hourStart,
        },
      };
    } else {
      setFlash({ kind: 'err', msg: 'This bet type is coming soon' });
      return;
    }

    setPending(true);
    startTransition(async () => {
      const result: PlaceBetResult = await placeBet({
        type: payload.type,
        payload: payload.data,
        stake,
      });
      setPending(false);
      if (result.ok) {
        const lbl = describeBet(payload.type, payload.data);
        setFlash({ kind: 'ok', msg: `BET PLACED · ${lbl.toUpperCase()}` });
        onPlaced?.(result.newBalance);
      } else {
        setFlash({ kind: 'err', msg: result.error.toUpperCase() });
      }
      setTimeout(() => setFlash(null), 2400);
    });
  };

  return (
    <aside className="bets">
      <div className="bets-head">
        <div className="title">Place a bet</div>
        <div className="bet-types">
          {BET_BUTTONS.map((bt) => (
            <button
              key={bt.id}
              className={`${betType === bt.id ? 'on' : ''}${bt.live ? '' : ' soon'}`}
              onClick={() => bt.live && setBetType(bt.id)}
              disabled={!bt.live}
            >
              {bt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bet-body">
        {betType === 'takeoff' && (
          <BetPromptBlock
            sub="Bet type · Quick"
            prompt={
              <>
                Which airport gets the{' '}
                <strong style={{ color: 'var(--ink-0)' }}>next takeoff</strong>?
              </>
            }
          >
            <AirportPicker
              value={pickedAirport}
              onChange={setPickedAirport}
              oddsFn={(a) => decimalToAmerican(takeoffOdds[a].decimal)}
            />
          </BetPromptBlock>
        )}

        {betType === 'heavy' && (
          <BetPromptBlock
            sub="Bet type · Quick · low frequency"
            prompt={
              <>
                Which airport gets the{' '}
                <strong style={{ color: 'var(--warn)' }}>next heavy</strong>? (777/787/A330+)
              </>
            }
          >
            <AirportPicker
              value={pickedAirport}
              onChange={setPickedAirport}
              oddsFn={(a) => decimalToAmerican(heavyOdds[a].decimal)}
            />
          </BetPromptBlock>
        )}

        {betType === 'race' && (
          <BetPromptBlock
            sub="Race Winner · Resolves at top of hour"
            prompt={<>Pick an airport to win this hour&apos;s race.</>}
          >
            <RaceSwitcher value={pickedRace} onChange={setPickedRace} />
            <div style={{ height: 8 }} />
            <AirportPicker
              value={pickedAirport}
              onChange={setPickedAirport}
              oddsFn={(a) => decimalToAmerican(raceWinOdds[a].decimal)}
            />
          </BetPromptBlock>
        )}

        {betType === 'raceou' && (
          <BetPromptBlock
            sub={`Race O/U · Auto-line ${suggestedLine}`}
            prompt={
              <>
                Total {pickedRace === 'total_ops' ? 'ops' : pickedRace + 's'} for{' '}
                <strong style={{ color: 'var(--ink-0)' }}>{pickedAirport}</strong> this hour.
              </>
            }
          >
            <RaceSwitcher value={pickedRace} onChange={setPickedRace} />
            <div style={{ height: 8 }} />
            <AirportPicker value={pickedAirport} onChange={setPickedAirport} />
            <div style={{ height: 8 }} />
            <div className="two-up">
              <div
                className={`ou-pick${pickedSide === 'over' ? ' on' : ''}`}
                onClick={() => setPickedSide('over')}
              >
                <div className="lbl">Over</div>
                <div className="v">{suggestedLine}</div>
                <div className="odds">{ouOdds.over.american}</div>
              </div>
              <div
                className={`ou-pick${pickedSide === 'under' ? ' on' : ''}`}
                onClick={() => setPickedSide('under')}
              >
                <div className="lbl">Under</div>
                <div className="v">{suggestedLine}</div>
                <div className="odds">{ouOdds.under.american}</div>
              </div>
            </div>
          </BetPromptBlock>
        )}

        {(betType === 'ou10' || betType === 'streak' || betType === 'margin') && (
          <BetPromptBlock sub="Coming soon" prompt={<>This bet type isn&apos;t live yet — pick another.</>}>
            <div className="airport-picker" style={{ opacity: 0.4, pointerEvents: 'none' }}>
              {AIRPORT_CODES.map((c) => (
                <div key={c} className={`airport-pick airport-${lc(c)}`}>
                  <span className="led" />
                  <span className="code">{c}</span>
                  <span className="odds">—</span>
                </div>
              ))}
            </div>
          </BetPromptBlock>
        )}

        <StakeBlock stake={stake} setStake={setStake} balance={balance} />

        <div className="payout-summary">
          <span className="k">To win</span>
          <span>
            <span className="v">✈ ${fmtMoney(profit)}</span>
            <span className="mult">
              {currentDecimal.toFixed(2)}x · {fmtAmerican(currentAmerican)}
            </span>
          </span>
        </div>

        {flash && (
          <div
            style={{
              fontSize: 11,
              letterSpacing: '0.06em',
              padding: '8px 10px',
              borderRadius: 6,
              border: `0.5px solid ${flash.kind === 'ok' ? 'var(--pos)' : 'var(--neg)'}`,
              color: flash.kind === 'ok' ? 'var(--pos)' : 'var(--neg)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {flash.msg}
          </div>
        )}

        <button
          className="place-btn"
          onClick={submit}
          disabled={pending || stake < MIN_BET || stake > MAX_BET || stake > balance}
        >
          {pending ? 'Placing…' : `Place ✈ $${fmtMoney(stake)} →`}
        </button>

        <div className="active-section">
          <div className="header">
            <span>Active bets</span>
            <span className="count">{bets.length}</span>
          </div>
          {bets.length === 0 && (
            <div style={{ padding: '12px 4px', color: 'var(--ink-3)', fontSize: 11 }}>
              No bets yet — place one above.
            </div>
          )}
          {bets.slice(0, 10).map((b) => {
            const klass =
              b.status === 'won' ? 'won' : b.status === 'lost' ? 'lost' : '';
            const tag = b.betType.replace(/_/g, ' ').toUpperCase();
            const desc = describeBetSafe(b);
            const showPay =
              b.status === 'open' ? b.potentialPayout : b.status === 'won' ? b.potentialPayout : 0;
            return (
              <div className={`active-bet ${klass}`} key={b.id}>
                <div className="desc">
                  <span className="tag">{tag}</span>
                  {desc}
                </div>
                <div className="pay">
                  <span className="v">✈ ${fmtMoney(showPay)}</span>
                  <span>
                    ✈ ${fmtMoney(b.stake)} ·{' '}
                    {b.status === 'open' ? 'live' : b.status.toUpperCase()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function describeBetSafe(b: ActiveBet): string {
  try {
    return describeBet(b.betType as BetTypeKey, b.betPayload as BetPayloadByType[BetTypeKey]);
  } catch {
    return b.betType;
  }
}

function BetPromptBlock({
  sub,
  prompt,
  children,
}: {
  sub: string;
  prompt: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="bet-prompt">
        <span className="sub">{sub}</span>
        {prompt}
      </div>
      <div style={{ height: 10 }} />
      {children}
    </div>
  );
}

function AirportPicker({
  value,
  onChange,
  oddsFn,
}: {
  value: AirportCode;
  onChange: (a: AirportCode) => void;
  oddsFn?: (a: AirportCode) => number;
}) {
  return (
    <div className="airport-picker">
      {AIRPORT_CODES.map((a) => {
        const odds = oddsFn ? oddsFn(a) : null;
        const on = value === a;
        return (
          <button
            key={a}
            className={`airport-pick airport-${a.toLowerCase()}${on ? ' on' : ''}`}
            onClick={() => onChange(a)}
            type="button"
          >
            <span className="led" />
            <span className="code">{a}</span>
            {odds != null && (
              <span className={`odds ${odds > 0 ? 'pos' : 'neg'}`}>{fmtAmerican(odds)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function RaceSwitcher({
  value,
  onChange,
}: {
  value: RaceType;
  onChange: (r: RaceType) => void;
}) {
  return (
    <div className="two-up" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
      {(['takeoff', 'heavy', 'total_ops'] as RaceType[]).map((r) => (
        <div
          key={r}
          className={`ou-pick${value === r ? ' on' : ''}`}
          onClick={() => onChange(r)}
        >
          <div className="lbl">{RACE_LABEL_SHORT[r]}</div>
        </div>
      ))}
    </div>
  );
}

function StakeBlock({
  stake,
  setStake,
  balance,
}: {
  stake: number;
  setStake: (n: number) => void;
  balance: number;
}) {
  const cap = Math.min(MAX_BET, Math.max(MIN_BET, balance));
  return (
    <div className="stake-row">
      <div className="stake-label">
        <span>Stake</span>
        <span>
          min ✈$10 · max ✈${MAX_BET.toLocaleString()}
        </span>
      </div>
      <div className="stake-input">
        <span className="glyph">✈$</span>
        <input
          type="text"
          inputMode="numeric"
          value={stake}
          onChange={(e) => {
            const n = parseInt(e.target.value.replace(/[^\d]/g, ''), 10);
            if (Number.isNaN(n)) setStake(0);
            else setStake(Math.min(MAX_BET, Math.max(0, n)));
          }}
        />
      </div>
      <div className="stake-chips">
        {[25, 50, 100, 250, 500].map((v) => (
          <button key={v} onClick={() => setStake(Math.min(cap, v))}>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

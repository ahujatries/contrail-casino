'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  AIRPORT_NAMES,
  getCurrentHourStart,
  msUntilNextHour,
  type AirportCode,
  type AllScores,
  type BetPayloadByType,
  type BetTypeKey,
} from '@airport-pong/shared';
import { placeBet } from '../actions/place-bet';
import type { ActiveBet } from './ActiveBets';
import { BetTimer } from './BetTimer';

type Pace = Record<AirportCode, number>;

const fmtOdds = (a: number) => (a > 0 ? `+${a}` : `${a}`);
const fmtMoney = (n: number) => Math.round(n).toLocaleString('en-US');
const decimalFromAmerican = (a: number) => (a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a));

type Mode = 'takeoff' | 'landing' | 'hour';

const MODES: Array<{ id: Mode; label: string; verb: string; noun: string }> = [
  { id: 'takeoff', label: 'Takeoff', verb: 'lifts off', noun: 'next takeoff' },
  { id: 'landing', label: 'Landing', verb: 'touches down', noun: 'next landing' },
  { id: 'hour', label: 'Hour Race', verb: 'wins the hour', noun: 'most movements by :00' },
];

type Side = 'a' | 'b';

type FlightSnippet = { callsign: string | null; typecode: string | null } | null;

type Props = {
  a1: AirportCode;
  a2: AirportCode;
  scores: AllScores;
  pace: { takeoff: Pace; heavy: Pace; total: Pace };
  liveFlights: Record<AirportCode, FlightSnippet>;
  balance: number;
  bets: ActiveBet[];
  onPlaced?: (newBalance: number) => void;
};

/**
 * Home stage: matchup header, mode switch, two PlaneCards, place bar, active bets.
 * Maps to existing backend bet types:
 *   takeoff → next_event on picked airport
 *   landing → next_event on picked airport (no `next_landing` type yet)
 *   hour    → race_winner total_ops on picked airport
 */
export function BetStage({
  a1,
  a2,
  scores,
  pace,
  liveFlights,
  balance,
  bets,
  onPlaced,
}: Props) {
  const [mode, setMode] = useState<Mode>('takeoff');
  const [side, setSide] = useState<Side>('a');
  const [stake, setStake] = useState(100);
  const [pending, setPending] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [, startTransition] = useTransition();

  const pickedKey: AirportCode = side === 'a' ? a1 : a2;
  const oppKey: AirportCode = side === 'a' ? a2 : a1;

  const [minsLeft, setMinsLeft] = useState(() => Math.max(1, Math.round(msUntilNextHour() / 60_000)));
  const [secsLeft, setSecsLeft] = useState(() => 59 - new Date().getUTCSeconds());
  useEffect(() => {
    const id = setInterval(() => {
      const ms = msUntilNextHour();
      setMinsLeft(Math.max(0, Math.floor(ms / 60_000)));
      setSecsLeft(Math.max(0, Math.floor((ms / 1000) % 60)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Live odds for the duel between a1 vs a2 under the current mode
  const { oA, oB } = useMemo(() => odds(a1, a2, mode, scores, pace), [a1, a2, mode, scores, pace]);
  const currentOdds = side === 'a' ? oA : oB;
  const dec = decimalFromAmerican(currentOdds);
  const profit = Math.round(stake * dec - stake);

  const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date().getUTCDay()];
  const modeMeta = MODES.find((m) => m.id === mode)!;

  const submit = () => {
    if (stake < 10 || stake > 1000) {
      setFlash({ kind: 'err', msg: 'STAKE MUST BE $10–$1,000' });
      return;
    }
    if (stake > balance) {
      setFlash({ kind: 'err', msg: 'STAKE EXCEEDS BALANCE' });
      return;
    }

    // Map duel mode to a real backend bet
    let payload: { type: BetTypeKey; data: BetPayloadByType[BetTypeKey] };
    if (mode === 'hour') {
      payload = {
        type: 'race_winner',
        data: {
          airport: pickedKey,
          raceType: 'total_ops',
          hourStart: getCurrentHourStart().toISOString(),
        },
      };
    } else {
      // Takeoff and Landing both map to next_event for the picked airport
      payload = {
        type: 'next_event',
        data: { airport: pickedKey },
      };
    }

    setPending(true);
    startTransition(async () => {
      const r = await placeBet({ type: payload.type, payload: payload.data, stake });
      setPending(false);
      if (r.ok) {
        setFlash({
          kind: 'ok',
          msg: `BET PLACED · ${pickedKey} ${modeMeta.verb} · ✈$${stake} to win ✈$${r.potentialPayout}`,
        });
        onPlaced?.(r.newBalance);
      } else {
        setFlash({ kind: 'err', msg: r.error.toUpperCase() });
      }
      setTimeout(() => setFlash(null), 3000);
    });
  };

  return (
    <section className="stage-bet">
      <div className="explain">
        <div className="micro mono">
          {dayOfWeek} · MATCHUP · LIVE
        </div>
        <h1 className="bigmatch">
          <span className={`apc apc-${a1.toLowerCase()}`}>{a1}</span>
          <span className="vs">vs</span>
          <span className={`apc apc-${a2.toLowerCase()}`}>{a2}</span>
        </h1>
        <p className="lede">
          Two planes. One race. <strong>Pick which one {modeMeta.verb} first.</strong>
        </p>
      </div>

      <div className="mode-switch" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={mode === m.id ? 'on' : ''}
            onClick={() => setMode(m.id)}
            role="tab"
            type="button"
          >
            <span className="ml">{m.label}</span>
            <span className="ms mono">{m.noun}</span>
          </button>
        ))}
      </div>

      <div className="duel">
        <PlaneCard
          airport={a1}
          side="left"
          mode={mode}
          live={liveFlights[a1]}
          score={scores}
          pace={pace.total[a1]}
          picked={side === 'a'}
          odds={oA}
          onPick={() => setSide('a')}
        />
        <div className="duel-mid">
          <div className="mid-label mono">{modeMeta.label}</div>
          <div className="vs-glyph">vs</div>
          {mode === 'hour' ? (
            <div className="mid-clock mono">
              ENDS IN
              <br />
              <span>
                {String(minsLeft).padStart(2, '0')}:{String(secsLeft).padStart(2, '0')}
              </span>
            </div>
          ) : (
            <div className="mid-clock mono">
              FIRST
              <br />
              <span>WINS</span>
            </div>
          )}
        </div>
        <PlaneCard
          airport={a2}
          side="right"
          mode={mode}
          live={liveFlights[a2]}
          score={scores}
          pace={pace.total[a2]}
          picked={side === 'b'}
          odds={oB}
          onPick={() => setSide('b')}
        />
      </div>

      <PlaceBar
        picked={pickedKey}
        opp={oppKey}
        live={liveFlights[pickedKey]}
        mode={mode}
        modeMeta={modeMeta}
        odds={currentOdds}
        dec={dec}
        profit={profit}
        stake={stake}
        setStake={setStake}
        balance={balance}
        pending={pending}
        flash={flash}
        onSubmit={submit}
      />

      <YourBets bets={bets} />
    </section>
  );
}

/* ─── PlaneCard ───────────────────────────────────────────── */

function PlaneCard({
  airport,
  side,
  mode,
  live,
  score,
  pace,
  picked,
  odds,
  onPick,
}: {
  airport: AirportCode;
  side: 'left' | 'right';
  mode: Mode;
  live: FlightSnippet;
  score: AllScores;
  pace: number;
  picked: boolean;
  odds: number;
  onPick: () => void;
}) {
  const name = AIRPORT_NAMES[airport].replace(/\s*\(.*\)\s*/, '');
  const isHour = mode === 'hour';
  const movements = score.total_ops[airport];
  const takeoffs = score.takeoff[airport];
  const landings = Math.max(0, movements - takeoffs);

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={picked}
      className={`plane-card airport-${airport.toLowerCase()} ${picked ? 'picked' : ''} ${side}`}
    >
      <div className="pc-airport">
        <span className="pc-led" aria-hidden />
        <div>
          <div className="pc-code">{airport}</div>
          <div className="pc-name mono">{name}</div>
        </div>
      </div>

      {!isHour && (
        <div className="pc-plane">
          <div className="pc-plane-label mono">
            {mode === 'takeoff' ? 'NEXT TO DEPART' : 'ON FINAL APPROACH'}
          </div>
          <div className="pc-plane-cs">{live?.callsign ?? '—'}</div>
          <div className="pc-plane-meta mono">
            <span>{live?.typecode ?? 'aircraft'}</span>
            <span className="sep">·</span>
            <span>{pace.toFixed(0)}/h pace</span>
          </div>
          <div className="pc-plane-eta mono">
            {mode === 'takeoff' ? 'queued for departure' : 'inbound from feeder'}
          </div>
        </div>
      )}

      {isHour && (
        <div className="pc-plane pc-plane-hour">
          <div className="pc-plane-label mono">MOVEMENTS THIS HOUR</div>
          <div className="pc-plane-cs hour-num">{movements}</div>
          <div className="pc-plane-meta mono">
            <span>{takeoffs} TO</span>
            <span className="sep">·</span>
            <span>{landings} LDG</span>
            <span className="sep">·</span>
            <span>{pace.toFixed(0)}/h pace</span>
          </div>
        </div>
      )}

      <div className="pc-bet">
        <div className="pc-bet-lbl mono">{picked ? 'YOUR PICK' : 'BET THIS PLANE'}</div>
        <div className="pc-bet-odds">{fmtOdds(odds)}</div>
      </div>
    </button>
  );
}

/* ─── PlaceBar ────────────────────────────────────────────── */

function PlaceBar({
  picked,
  opp,
  live,
  modeMeta,
  odds,
  dec,
  profit,
  stake,
  setStake,
  balance,
  pending,
  flash,
  onSubmit,
}: {
  picked: AirportCode;
  opp: AirportCode;
  live: FlightSnippet;
  mode: Mode;
  modeMeta: { label: string; verb: string };
  odds: number;
  dec: number;
  profit: number;
  stake: number;
  setStake: (n: number) => void;
  balance: number;
  pending: boolean;
  flash: { kind: 'ok' | 'err'; msg: string } | null;
  onSubmit: () => void;
}) {
  const valid = stake >= 10 && stake <= 1000 && stake <= balance;
  return (
    <>
      <div className="place-bar">
        <div className="pb-left">
          <div className="pb-tag mono">YOUR BET</div>
          <div className="pb-desc">
            <span className={`apc apc-${picked.toLowerCase()}`}>{picked}</span>
            {live?.callsign && <span className="pb-cs mono"> · {live.callsign}</span>}
            <span className="pb-verb"> {modeMeta.verb} first</span>{' '}
            <span className="pb-verb" style={{ color: 'var(--ink-3)' }}>vs {opp}</span>
          </div>
        </div>

        <div className="pb-stake">
          <div className="pb-row mono">
            <span>STAKE</span>
            <span className="pb-chips">
              {[25, 50, 100, 250].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStake(v)}
                  className={stake === v ? 'on' : ''}
                >
                  {v}
                </button>
              ))}
            </span>
          </div>
          <div className="pb-input">
            <span className="g">✈$</span>
            <input
              type="text"
              inputMode="numeric"
              value={stake}
              onChange={(e) => {
                const n = parseInt(String(e.target.value).replace(/[^\d]/g, ''), 10);
                setStake(Number.isNaN(n) ? 0 : Math.min(1000, Math.max(0, n)));
              }}
            />
          </div>
        </div>

        <div className="pb-payout">
          <div className="pb-row mono">
            <span>TO WIN</span>
            <span>
              {fmtOdds(odds)} · {dec.toFixed(2)}x
            </span>
          </div>
          <div className="pb-win">✈ ${fmtMoney(profit)}</div>
        </div>

        <button className="pb-go" type="button" disabled={!valid || pending} onClick={onSubmit}>
          {pending ? 'Placing…' : 'Place bet →'}
        </button>
      </div>
      {flash && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.1em',
            padding: '10px 14px',
            border: `1px solid ${flash.kind === 'ok' ? 'var(--pos)' : 'var(--neg)'}`,
            borderRadius: 2,
            color: flash.kind === 'ok' ? 'var(--pos)' : 'var(--neg)',
            background: 'var(--bg-1)',
          }}
        >
          {flash.msg}
        </div>
      )}
    </>
  );
}

/* ─── YourBets (inline) ────────────────────────────────── */

function YourBets({ bets }: { bets: ActiveBet[] }) {
  const open = bets.filter((b) => b.status === 'open');
  if (open.length === 0) return null;
  return (
    <div className="your-bets">
      <div className="yb-head mono">
        <span>YOUR BETS</span>
        <span className="yb-count">{open.length} OPEN</span>
      </div>
      <ul>
        {open.slice(0, 6).map((b) => {
          const apCode = (b.betPayload as { airport?: string })?.airport ?? '';
          return (
            <li key={b.id}>
              <div className="yb-l">
                <div className="yb-desc">
                  <span className={`apc apc-${apCode.toLowerCase()}`}>{apCode}</span>
                  <span className="yb-verb mono"> · {b.betType.replace(/_/g, ' ')}</span>
                </div>
                <BetTimer
                  betType={b.betType as BetTypeKey}
                  payload={b.betPayload}
                  placedAt={b.placedAt}
                  resolvedAt={b.resolvedAt}
                  status={b.status}
                />
              </div>
              <div className="yb-r mono">
                <span className="yb-status">● OPEN</span>
                <span>risk ✈${b.stake.toLocaleString('en-US')}</span>
                <span className="yb-win">to win ✈${b.potentialPayout.toLocaleString('en-US')}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── Local odds calc for the duel ────────────────────────── */

const probToAmerican = (p: number) => {
  if (p >= 0.5) return -Math.round((p / (1 - p)) * 100);
  return Math.round(((1 - p) / p) * 100);
};

const odds = (
  a: AirportCode,
  b: AirportCode,
  mode: Mode,
  scores: AllScores,
  pace: { takeoff: Pace; heavy: Pace; total: Pace }
) => {
  if (mode === 'hour') {
    // Race winner (total_ops) duel: weighted by current totals + remaining pace
    const totalA = scores.total_ops[a] + pace.total[a] * 0.5;
    const totalB = scores.total_ops[b] + pace.total[b] * 0.5;
    const sum = Math.max(0.01, totalA + totalB);
    const pA = Math.min(0.88, (totalA / sum) * 1.04);
    return { oA: probToAmerican(pA), oB: probToAmerican(1 - pA) };
  }
  // takeoff / landing: weight by recent takeoff pace (fast-pace = sooner)
  const paceA = Math.max(0.1, pace.takeoff[a]);
  const paceB = Math.max(0.1, pace.takeoff[b]);
  const pAraw = paceA / (paceA + paceB);
  // narrow toward 50/50 a bit, add 5% margin
  const pA = Math.min(0.88, (0.5 + (pAraw - 0.5) * 0.75) * 1.05);
  return { oA: probToAmerican(pA), oB: probToAmerican(1 - pA) };
};

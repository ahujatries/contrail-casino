'use client';

import { useEffect, useState } from 'react';
import { AIRPORT_COLORS, type AirportCode } from '@airport-pong/shared';
import { StakeAndPlace } from './StakeAndPlace';
import { Explainer } from './NextTakeoffForm';

type Contestant = {
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  velocityKt: number;
  headingDeg: number | null;
};

type Pair = {
  pairId: string;
  airport: AirportCode;
  left: Contestant;
  right: Contestant;
};

const POLL_MS = 15_000;

export function TakeoffRaceForm({
  initialPairs,
  balance,
}: {
  initialPairs: Pair[];
  balance: number;
}) {
  const [pairs, setPairs] = useState<Pair[]>(initialPairs);
  const [pickedPair, setPickedPair] = useState<string | null>(initialPairs[0]?.pairId ?? null);
  const [pickedSide, setPickedSide] = useState<'left' | 'right'>('left');

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/takeoff-races', { cache: 'no-store' });
        if (!r.ok) return;
        const { pairs: next } = (await r.json()) as { pairs: Pair[] };
        if (cancelled) return;
        setPairs(next);
        if (pickedPair && !next.some((p) => p.pairId === pickedPair)) {
          setPickedPair(next[0]?.pairId ?? null);
        }
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pickedPair]);

  const current = pairs.find((p) => p.pairId === pickedPair) ?? null;
  const decimal = 1.9;
  const american = -111;

  const payload = current
    ? {
        airport: current.airport,
        pickedSide,
        leftIcao24: current.left.icao24,
        leftCallsign: current.left.callsign,
        rightIcao24: current.right.icao24,
        rightCallsign: current.right.callsign,
        pairId: current.pairId,
      }
    : null;

  return (
    <>
      <Explainer
        bullets={[
          'Two aircraft taxiing fast at the same airport (15–50 kt ground speed = near the runway). Pick which one rotates first.',
          'Pairs are formed by descending velocity — the front of the queue gets matched up. Resolves the instant either aircraft triggers a takeoff event, usually 1–8 min.',
          'Limitations: we can\'t see actual runway assignment, so two queued aircraft might be heading to different runways and not really competing for the same slot. Still — first one airborne wins.',
        ]}
      />

      {pairs.length === 0 && (
        <div className="lr-empty">
          <strong>NO QUEUED PAIRS RIGHT NOW</strong>
          <div>
            None of the 4 airports has two aircraft actively taxiing fast at the same time.
            Try the Landing Race table or wait a few minutes.
          </div>
        </div>
      )}

      {pairs.length > 0 && (
        <>
          <div className="bet-section-head">CHOOSE A PAIR · {pairs.length} LIVE</div>
          <div className="lr-pair-list">
            {pairs.map((p) => (
              <button
                key={p.pairId}
                className={`lr-pair-card${pickedPair === p.pairId ? ' on' : ''}`}
                onClick={() => setPickedPair(p.pairId)}
                style={{ borderLeftColor: AIRPORT_COLORS[p.airport] }}
              >
                <div className="lr-pair-head">
                  <span className="ap" style={{ color: AIRPORT_COLORS[p.airport] }}>
                    {p.airport}
                  </span>
                  <span className="delta">QUEUE</span>
                </div>
                <div className="lr-pair-row">
                  <span>{p.left.callsign ?? p.left.icao24}</span>
                  <span className="mono">{p.left.velocityKt}kt</span>
                </div>
                <div className="lr-pair-row">
                  <span>{p.right.callsign ?? p.right.icao24}</span>
                  <span className="mono">{p.right.velocityKt}kt</span>
                </div>
              </button>
            ))}
          </div>

          {current && (
            <>
              <div className="bet-section-head">PICK · {current.airport} GROUND</div>
              <div className="lr-pick-row">
                <ContestantTile
                  contestant={current.left}
                  side="left"
                  on={pickedSide === 'left'}
                  accent={AIRPORT_COLORS[current.airport]}
                  onClick={() => setPickedSide('left')}
                />
                <div className="lr-vs">VS</div>
                <ContestantTile
                  contestant={current.right}
                  side="right"
                  on={pickedSide === 'right'}
                  accent={AIRPORT_COLORS[current.airport]}
                  onClick={() => setPickedSide('right')}
                />
              </div>
              <p className="bet-foot-note">
                Resolves on first takeoff event for either aircraft (UTC)
              </p>
            </>
          )}
        </>
      )}

      <StakeAndPlace
        betType="takeoff_race"
        payload={payload}
        decimalOdds={decimal}
        americanOdds={american}
        balance={balance}
        ctaLabel={
          current
            ? `Bet ${(pickedSide === 'left' ? current.left.callsign : current.right.callsign) ?? '?'} takes off first`
            : 'Bet'
        }
      />
    </>
  );
}

function ContestantTile({
  contestant,
  side,
  on,
  accent,
  onClick,
}: {
  contestant: Contestant;
  side: 'left' | 'right';
  on: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`lr-contestant${on ? ' on' : ''}`}
      onClick={onClick}
      style={on ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent} inset` } : {}}
    >
      <div className="head">
        <span className="cs">{contestant.callsign ?? contestant.icao24.toUpperCase()}</span>
        {contestant.typecode && (
          <span className="tc">
            {contestant.typecode}
            {contestant.isHeavy ? ' · HVY' : ''}
          </span>
        )}
      </div>
      <div className="big-eta">{contestant.velocityKt}<span style={{fontSize:14, color:'var(--ink-3)', marginLeft:4}}>kt</span></div>
      <div className="meta">
        <span>ground</span>
        <span>·</span>
        <span>hdg {contestant.headingDeg != null ? String(Math.round(contestant.headingDeg)).padStart(3, '0') + '°' : '—'}</span>
      </div>
      <div className="side-tag">{side === 'left' ? 'A' : 'B'}</div>
    </button>
  );
}

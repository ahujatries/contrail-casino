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
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  velocityKt: number | null;
  headingDeg: number | null;
  etaMin: number;
  expectedLandingAt: string;
  distanceNm: number;
};

type Pair = {
  pairId: string;
  airport: AirportCode;
  left: Contestant;
  right: Contestant;
  deltaSec: number;
};

const POLL_MS = 15_000;

export function LandingRaceForm({
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
        const r = await fetch('/api/landing-races', { cache: 'no-store' });
        if (!r.ok) return;
        const { pairs: next } = (await r.json()) as { pairs: Pair[] };
        if (cancelled) return;
        setPairs(next);
        // If our selected pair disappeared, pick the first available
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
        expectedLandingAt:
          pickedSide === 'left' ? current.left.expectedLandingAt : current.right.expectedLandingAt,
        pairId: current.pairId,
      }
    : null;

  return (
    <>
      <Explainer
        bullets={[
          'Two aircraft on final approach to the same airport, paired automatically because their estimated landing times are within ~1 minute of each other. Pick which one touches down first.',
          'ETA is computed from each aircraft’s current distance to the field and ground speed (real OpenSky telemetry). Times shown are UTC.',
          'Resolves the instant either aircraft generates a landing event — usually within a few minutes. Odds are near-even (1.9x).',
          'Pairs come and go as aircraft enter and leave the approach window — keep an eye on the freshness clock per pair.',
        ]}
      />

      {pairs.length === 0 && (
        <div className="lr-empty">
          <strong>NO PAIRED APPROACHES RIGHT NOW</strong>
          <div>
            Nothing in our 4 airports has two arrivals within ~60s of each other. Approaches
            come and go; refresh in a minute or pick another bet type.
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
                  <span className="delta">Δ {p.deltaSec.toFixed(0)}s</span>
                </div>
                <div className="lr-pair-row">
                  <span>{p.left.callsign ?? p.left.icao24}</span>
                  <span className="mono">{utcTime(p.left.expectedLandingAt)}</span>
                </div>
                <div className="lr-pair-row">
                  <span>{p.right.callsign ?? p.right.icao24}</span>
                  <span className="mono">{utcTime(p.right.expectedLandingAt)}</span>
                </div>
              </button>
            ))}
          </div>

          {current && (
            <>
              <div className="bet-section-head">PICK YOUR PLANE · {current.airport}</div>
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
                Pair Δ {current.deltaSec.toFixed(0)}s · resolves on first landing event for either aircraft (UTC)
              </p>
            </>
          )}
        </>
      )}

      <StakeAndPlace
        betType="landing_race"
        payload={payload}
        decimalOdds={decimal}
        americanOdds={american}
        balance={balance}
        ctaLabel={
          current
            ? `Bet ${(pickedSide === 'left' ? current.left.callsign : current.right.callsign) ?? '?'} lands first`
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
      <div className="big-eta">{utcTime(contestant.expectedLandingAt)}</div>
      <div className="meta">
        <span>ETA {contestant.etaMin.toFixed(1)}m</span>
        <span>·</span>
        <span>{Math.round(contestant.distanceNm)}nm</span>
        <span>·</span>
        <span>
          {contestant.altitudeFt != null ? Math.round(contestant.altitudeFt).toLocaleString() : '?'}ft
        </span>
        <span>·</span>
        <span>{contestant.velocityKt}kt</span>
      </div>
      <div className="side-tag">{side === 'left' ? 'A' : 'B'}</div>
    </button>
  );
}

const utcTime = (iso: string) => new Date(iso).toISOString().slice(11, 19) + 'Z';

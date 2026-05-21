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
  leftAirport: AirportCode;
  rightAirport: AirportCode;
  left: Contestant;
  right: Contestant;
  deltaSec: number;
};

type Resp = { airportPair: [AirportCode, AirportCode]; pairs: Pair[] };

const POLL_MS = 15_000;
const utcTime = (iso: string) => new Date(iso).toISOString().slice(11, 19) + 'Z';

export function CrossAirportRaceForm({
  initialPairs,
  initialAirportPair,
  balance,
}: {
  initialPairs: Pair[];
  initialAirportPair: [AirportCode, AirportCode];
  balance: number;
}) {
  const [pairs, setPairs] = useState<Pair[]>(initialPairs);
  const [airportPair, setAirportPair] = useState<[AirportCode, AirportCode]>(initialAirportPair);
  const [pickedPair, setPickedPair] = useState<string | null>(initialPairs[0]?.pairId ?? null);
  const [pickedSide, setPickedSide] = useState<'left' | 'right'>('left');

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/cross-airport-races?a=${airportPair[0]}&b=${airportPair[1]}`, {
          cache: 'no-store',
        });
        if (!r.ok) return;
        const data = (await r.json()) as Resp;
        if (cancelled) return;
        setPairs(data.pairs);
        if (pickedPair && !data.pairs.some((p) => p.pairId === pickedPair)) {
          setPickedPair(data.pairs[0]?.pairId ?? null);
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
  }, [airportPair, pickedPair]);

  const current = pairs.find((p) => p.pairId === pickedPair) ?? null;
  const decimal = 1.9;
  const american = -111;

  const payload = current
    ? {
        pickedSide,
        leftAirport: current.leftAirport,
        leftIcao24: current.left.icao24,
        leftCallsign: current.left.callsign,
        rightAirport: current.rightAirport,
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
          'Same idea as Landing Race, but the two aircraft are on approach to DIFFERENT airports. Pick which airport gets its plane down first.',
          'Pairs are formed when an aircraft inbound to airport A and an aircraft inbound to airport B have ETAs within 60 seconds of each other.',
          'Defaults to today\'s featured pair. Use the pair switcher to scan other combinations.',
        ]}
      />

      <div className="bet-section-head">AIRPORT PAIR</div>
      <div className="cross-pair-switcher">
        {([
          ['JFK', 'ORD'],
          ['JFK', 'ATL'],
          ['JFK', 'LAX'],
          ['ORD', 'ATL'],
          ['ORD', 'LAX'],
          ['ATL', 'LAX'],
        ] as Array<[AirportCode, AirportCode]>).map((p) => {
          const on = p[0] === airportPair[0] && p[1] === airportPair[1];
          return (
            <button
              key={p.join('-')}
              onClick={() => setAirportPair(p)}
              className={`cross-pair-btn${on ? ' on' : ''}`}
            >
              <span style={{ color: AIRPORT_COLORS[p[0]] }}>{p[0]}</span>
              <span className="vs">×</span>
              <span style={{ color: AIRPORT_COLORS[p[1]] }}>{p[1]}</span>
            </button>
          );
        })}
      </div>

      {pairs.length === 0 && (
        <div className="lr-empty">
          <strong>NO PAIRED APPROACHES BETWEEN {airportPair.join(' · ')} RIGHT NOW</strong>
          <div>
            We need one inbound at each airport with ETAs within 60s. Try another pair or
            wait a few minutes.
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
              >
                <div className="lr-pair-head">
                  <span className="ap">{p.leftAirport} × {p.rightAirport}</span>
                  <span className="delta">Δ {p.deltaSec.toFixed(0)}s</span>
                </div>
                <div className="lr-pair-row">
                  <span style={{ color: AIRPORT_COLORS[p.leftAirport] }}>
                    {p.left.callsign ?? p.left.icao24} → {p.leftAirport}
                  </span>
                  <span className="mono">{utcTime(p.left.expectedLandingAt)}</span>
                </div>
                <div className="lr-pair-row">
                  <span style={{ color: AIRPORT_COLORS[p.rightAirport] }}>
                    {p.right.callsign ?? p.right.icao24} → {p.rightAirport}
                  </span>
                  <span className="mono">{utcTime(p.right.expectedLandingAt)}</span>
                </div>
              </button>
            ))}
          </div>

          {current && (
            <>
              <div className="bet-section-head">PICK YOUR PLANE</div>
              <div className="lr-pick-row">
                <ContestantTile
                  contestant={current.left}
                  airport={current.leftAirport}
                  on={pickedSide === 'left'}
                  onClick={() => setPickedSide('left')}
                />
                <div className="lr-vs">VS</div>
                <ContestantTile
                  contestant={current.right}
                  airport={current.rightAirport}
                  on={pickedSide === 'right'}
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
        betType="cross_airport_race"
        payload={payload}
        decimalOdds={decimal}
        americanOdds={american}
        balance={balance}
        ctaLabel={
          current
            ? `Bet ${(pickedSide === 'left' ? current.leftAirport : current.rightAirport)} lands first`
            : 'Bet'
        }
      />
    </>
  );
}

function ContestantTile({
  contestant,
  airport,
  on,
  onClick,
}: {
  contestant: Contestant;
  airport: AirportCode;
  on: boolean;
  onClick: () => void;
}) {
  const accent = AIRPORT_COLORS[airport];
  return (
    <button
      className={`lr-contestant${on ? ' on' : ''}`}
      onClick={onClick}
      style={on ? { borderColor: accent, boxShadow: `0 0 0 1px ${accent} inset` } : {}}
    >
      <div className="head">
        <span className="cs" style={{ color: accent }}>
          {contestant.callsign ?? contestant.icao24.toUpperCase()}
        </span>
        {contestant.typecode && (
          <span className="tc">
            {contestant.typecode}
            {contestant.isHeavy ? ' · HVY' : ''}
          </span>
        )}
      </div>
      <div className="big-eta">{utcTime(contestant.expectedLandingAt)}</div>
      <div className="meta">
        <span style={{ color: accent }}>→ {airport}</span>
        <span>·</span>
        <span>ETA {contestant.etaMin.toFixed(1)}m</span>
        <span>·</span>
        <span>{Math.round(contestant.distanceNm)}nm</span>
      </div>
      <div className="side-tag">{airport}</div>
    </button>
  );
}

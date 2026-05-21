'use client';

import { useEffect, useMemo, useState } from 'react';
import { AIRPORT_COLORS, probabilityToOdds, type AirportCode } from '@airport-pong/shared';
import { StakeAndPlace } from './StakeAndPlace';
import { Explainer } from './NextTakeoffForm';

type HeavyPair = {
  pairId: string;
  leftAirport: AirportCode;
  rightAirport: AirportCode;
  leftPace: number;
  rightPace: number;
  probLeft: number;
};

const POLL_MS = 30_000;

export function HeavyRaceForm({
  initialPairs,
  balance,
}: {
  initialPairs: HeavyPair[];
  balance: number;
}) {
  const [pairs, setPairs] = useState<HeavyPair[]>(initialPairs);
  const [pickedPair, setPickedPair] = useState<string | null>(initialPairs[0]?.pairId ?? null);
  const [pickedSide, setPickedSide] = useState<'left' | 'right'>('left');

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch('/api/heavy-races', { cache: 'no-store' });
        if (!r.ok) return;
        const { pairs: next } = (await r.json()) as { pairs: HeavyPair[] };
        if (cancelled) return;
        setPairs(next);
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const current = pairs.find((p) => p.pairId === pickedPair) ?? null;

  const oddsForCurrent = useMemo(() => {
    if (!current) return null;
    const prob = pickedSide === 'left' ? current.probLeft : 1 - current.probLeft;
    return probabilityToOdds(prob);
  }, [current, pickedSide]);

  const payload = current
    ? {
        pickedSide,
        leftAirport: current.leftAirport,
        rightAirport: current.rightAirport,
        pairId: current.pairId,
      }
    : null;

  return (
    <>
      <Explainer
        bullets={[
          'Pick an airport pair. Whichever airport sees the next heavy widebody movement (takeoff OR landing) first wins.',
          'Odds are weighted by 60-min heavy pace at each airport. Higher heavy traffic = shorter odds.',
          'No specific aircraft — the bet sits open until any heavy fires at either of your chosen airports. Usually 1–30 min.',
        ]}
      />

      <div className="bet-section-head">CHOOSE A PAIR · {pairs.length} TABLES</div>
      <div className="lr-pair-list">
        {pairs.map((p) => {
          const on = pickedPair === p.pairId;
          return (
            <button
              key={p.pairId}
              className={`lr-pair-card${on ? ' on' : ''}`}
              onClick={() => setPickedPair(p.pairId)}
            >
              <div className="lr-pair-head">
                <span className="ap">
                  <span style={{ color: AIRPORT_COLORS[p.leftAirport] }}>{p.leftAirport}</span>
                  {' × '}
                  <span style={{ color: AIRPORT_COLORS[p.rightAirport] }}>{p.rightAirport}</span>
                </span>
                <span className="delta">PACE</span>
              </div>
              <div className="lr-pair-row">
                <span style={{ color: AIRPORT_COLORS[p.leftAirport] }}>{p.leftAirport}</span>
                <span className="mono">
                  {p.leftPace.toFixed(1)}/h · {Math.round(p.probLeft * 100)}%
                </span>
              </div>
              <div className="lr-pair-row">
                <span style={{ color: AIRPORT_COLORS[p.rightAirport] }}>{p.rightAirport}</span>
                <span className="mono">
                  {p.rightPace.toFixed(1)}/h · {Math.round((1 - p.probLeft) * 100)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {current && (
        <>
          <div className="bet-section-head">PICK A SIDE</div>
          <div className="lr-pick-row">
            <button
              className={`lr-contestant${pickedSide === 'left' ? ' on' : ''}`}
              onClick={() => setPickedSide('left')}
              style={
                pickedSide === 'left'
                  ? {
                      borderColor: AIRPORT_COLORS[current.leftAirport],
                      boxShadow: `0 0 0 1px ${AIRPORT_COLORS[current.leftAirport]} inset`,
                    }
                  : {}
              }
            >
              <div className="head">
                <span className="cs" style={{ color: AIRPORT_COLORS[current.leftAirport] }}>
                  {current.leftAirport}
                </span>
              </div>
              <div className="big-eta">{Math.round(current.probLeft * 100)}%</div>
              <div className="meta">
                <span>{current.leftPace.toFixed(1)} heavies / hour</span>
              </div>
              <div className="side-tag">A</div>
            </button>
            <div className="lr-vs">VS</div>
            <button
              className={`lr-contestant${pickedSide === 'right' ? ' on' : ''}`}
              onClick={() => setPickedSide('right')}
              style={
                pickedSide === 'right'
                  ? {
                      borderColor: AIRPORT_COLORS[current.rightAirport],
                      boxShadow: `0 0 0 1px ${AIRPORT_COLORS[current.rightAirport]} inset`,
                    }
                  : {}
              }
            >
              <div className="head">
                <span className="cs" style={{ color: AIRPORT_COLORS[current.rightAirport] }}>
                  {current.rightAirport}
                </span>
              </div>
              <div className="big-eta">{Math.round((1 - current.probLeft) * 100)}%</div>
              <div className="meta">
                <span>{current.rightPace.toFixed(1)} heavies / hour</span>
              </div>
              <div className="side-tag">B</div>
            </button>
          </div>
          <p className="bet-foot-note">
            Resolves on first heavy movement (takeoff or landing) at either {current.leftAirport} or{' '}
            {current.rightAirport} (UTC)
          </p>
        </>
      )}

      <StakeAndPlace
        betType="heavy_race"
        payload={payload}
        decimalOdds={oddsForCurrent?.decimal ?? 1.9}
        americanOdds={
          oddsForCurrent
            ? oddsForCurrent.decimal >= 2
              ? Math.round((oddsForCurrent.decimal - 1) * 100)
              : Math.round(-100 / (oddsForCurrent.decimal - 1))
            : -111
        }
        balance={balance}
        ctaLabel={
          current
            ? `Bet ${pickedSide === 'left' ? current.leftAirport : current.rightAirport} gets next heavy`
            : 'Bet'
        }
      />
    </>
  );
}

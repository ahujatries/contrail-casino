'use client';

import { useMemo, useState } from 'react';
import {
  AIRPORT_CODES,
  nextEventOdds,
  type AirportCode,
} from '@airport-pong/shared';
import { StakeAndPlace } from './StakeAndPlace';
import { ContextGrid, ContextCell, Explainer } from './NextTakeoffForm';

type Pace = Record<AirportCode, number>;

const fmtA = (a: number) => (a > 0 ? `+${a}` : `${a}`);
const decimalToAmerican = (d: number) => (d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)));

export function NextHeavyForm({
  heavyPace,
  todayTotals,
  balance,
}: {
  heavyPace: Pace;
  todayTotals: Record<AirportCode, { takeoff: number; landing: number; heavy: number; total: number }>;
  balance: number;
}) {
  const [picked, setPicked] = useState<AirportCode>('JFK');
  const odds = useMemo(() => nextEventOdds(heavyPace), [heavyPace]);
  const decimal = odds[picked].decimal;

  return (
    <>
      <Explainer
        bullets={[
          'A "heavy" is a wide-body aircraft — B777, B787, B747, A330, A340, A350, A380. They show up on flight strips with the suffix HVY.',
          'You’re betting on which airport sees the next heavy movement (takeoff OR landing). Lower frequency than normal events = bigger payouts.',
          'Odds are based on rolling 60-min heavy pace per airport. International gateways (JFK, LAX) usually carry shorter odds.',
        ]}
      />

      <ContextGrid>
        {AIRPORT_CODES.map((c) => (
          <ContextCell
            key={c}
            airport={c}
            primary={`${heavyPace[c].toFixed(1)} heavies/h`}
            secondary={`Today: ${todayTotals[c].heavy} heavy · ${todayTotals[c].total} total ops`}
            odds={fmtA(decimalToAmerican(odds[c].decimal))}
            prob={`${Math.round(odds[c].probability * 100)}%`}
          />
        ))}
      </ContextGrid>

      <div className="airport-picker big">
        {AIRPORT_CODES.map((c) => (
          <button
            key={c}
            className={`airport-pick big airport-${c.toLowerCase()}${picked === c ? ' on' : ''}`}
            onClick={() => setPicked(c)}
          >
            <span className="led" />
            <span className="code">{c}</span>
            <span className={`odds ${decimalToAmerican(odds[c].decimal) > 0 ? 'pos' : ''}`}>
              {fmtA(decimalToAmerican(odds[c].decimal))}
            </span>
          </button>
        ))}
      </div>

      <StakeAndPlace
        betType="next_heavy"
        payload={{ airport: picked }}
        decimalOdds={decimal}
        americanOdds={decimalToAmerican(decimal)}
        balance={balance}
        ctaLabel={`Bet ${picked} for next heavy`}
      />
    </>
  );
}

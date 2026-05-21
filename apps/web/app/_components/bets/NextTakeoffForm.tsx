'use client';

import { useMemo, useState } from 'react';
import {
  AIRPORT_CODES,
  AIRPORT_COLORS,
  nextEventOdds,
  type AirportCode,
} from '@airport-pong/shared';
import { StakeAndPlace } from './StakeAndPlace';

type Pace = Record<AirportCode, number>;

const fmtA = (a: number) => (a > 0 ? `+${a}` : `${a}`);
const decimalToAmerican = (d: number) => (d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)));

export function NextTakeoffForm({
  pace,
  todayTotals,
  balance,
}: {
  pace: Pace;
  todayTotals: Record<AirportCode, { takeoff: number; landing: number; heavy: number; total: number }>;
  balance: number;
}) {
  const [picked, setPicked] = useState<AirportCode>('JFK');
  const odds = useMemo(() => nextEventOdds(pace), [pace]);
  const decimal = odds[picked].decimal;

  return (
    <>
      <Explainer
        bullets={[
          'You’re betting on which airport gets the next TAKEOFF event. Any plane. Resolves the moment any aircraft lifts off, usually within a minute.',
          'Odds are derived from rolling 30-min takeoff pace at each airport, with a 5% house edge. Busier airports = shorter odds.',
          'Times here and across the site are UTC.',
        ]}
      />

      <ContextGrid>
        {AIRPORT_CODES.map((c) => (
          <ContextCell
            key={c}
            airport={c}
            primary={`${pace[c].toFixed(0)}/h pace`}
            secondary={`Today: ${todayTotals[c].takeoff} TO · ${todayTotals[c].total} ops`}
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
        betType="next_event"
        payload={{ airport: picked }}
        decimalOdds={decimal}
        americanOdds={decimalToAmerican(decimal)}
        balance={balance}
        ctaLabel={`Bet ${picked} for next takeoff`}
      />
    </>
  );
}

export function Explainer({ bullets }: { bullets: string[] }) {
  return (
    <ul className="bet-explainer">
      {bullets.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

export function ContextGrid({ children }: { children: React.ReactNode }) {
  return <div className="ctx-grid">{children}</div>;
}

export function ContextCell({
  airport,
  primary,
  secondary,
  odds,
  prob,
}: {
  airport: AirportCode;
  primary: string;
  secondary: string;
  odds?: string;
  prob?: string;
}) {
  return (
    <div className={`ctx-cell airport-${airport.toLowerCase()}`} style={{ borderLeftColor: AIRPORT_COLORS[airport] }}>
      <div className="ctx-head">
        <span className="code">{airport}</span>
        {odds && <span className="odds">{odds}</span>}
      </div>
      <div className="ctx-primary">{primary}</div>
      <div className="ctx-secondary">
        {secondary}
        {prob && <> · {prob}</>}
      </div>
    </div>
  );
}

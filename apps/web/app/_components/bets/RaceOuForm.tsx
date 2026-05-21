'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AIRPORT_CODES,
  getCurrentHourStart,
  msUntilNextHour,
  raceOverUnderOdds,
  suggestedLineForHour,
  type AirportCode,
  type AllScores,
  type RaceType,
} from '@airport-pong/shared';
import { StakeAndPlace } from './StakeAndPlace';
import { ContextCell, ContextGrid, Explainer } from './NextTakeoffForm';

type Pace = Record<AirportCode, number>;

const RACE_LABEL: Record<RaceType, string> = {
  takeoff: 'Takeoff',
  heavy: 'Heavy',
  total_ops: 'Total Ops',
};

const fmtA = (a: number) => (a > 0 ? `+${a}` : `${a}`);
const decimalToAmerican = (d: number) => (d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)));

export function RaceOuForm({
  scores,
  takeoffPace,
  heavyPace,
  totalPace,
  balance,
}: {
  scores: AllScores;
  takeoffPace: Pace;
  heavyPace: Pace;
  totalPace: Pace;
  balance: number;
}) {
  const [race, setRace] = useState<RaceType>('takeoff');
  const [airport, setAirport] = useState<AirportCode>('JFK');
  const [side, setSide] = useState<'over' | 'under'>('over');
  const [minsLeft, setMinsLeft] = useState(60);
  useEffect(() => {
    const update = () => setMinsLeft(Math.max(1, Math.round(msUntilNextHour() / 60_000)));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  const paceForRace = race === 'takeoff' ? takeoffPace : race === 'heavy' ? heavyPace : totalPace;
  const line = suggestedLineForHour(scores[race][airport], paceForRace[airport], minsLeft);
  const ou = useMemo(
    () =>
      raceOverUnderOdds({
        currentScore: scores[race][airport],
        pace: paceForRace[airport],
        minutesRemaining: minsLeft,
        line,
      }),
    [scores, paceForRace, race, airport, minsLeft, line]
  );
  const decimal = side === 'over' ? ou.over.decimal : ou.under.decimal;
  const hourStart = getCurrentHourStart().toISOString();

  return (
    <>
      <Explainer
        bullets={[
          'Pick an airport, a race (Takeoff / Heavy / Total Ops), and bet that the hourly count finishes OVER or UNDER an auto-suggested line.',
          'The line is computed from current score plus pace × remaining-time, then rounded to .5 so there’s always a clear winner.',
          'Resolves at the top of the hour. If the final score matches the line exactly (rare), the bet pushes and stake refunds.',
        ]}
      />

      <div className="bet-section-head">RACE</div>
      <div className="race-tab-row">
        {(['takeoff', 'heavy', 'total_ops'] as RaceType[]).map((r) => (
          <button
            key={r}
            className={`race-tab${race === r ? ' on' : ''}`}
            onClick={() => setRace(r)}
          >
            <span className="lbl">{RACE_LABEL[r]}</span>
          </button>
        ))}
      </div>

      <div className="bet-section-head">AIRPORT</div>
      <div className="airport-picker big">
        {AIRPORT_CODES.map((c) => (
          <button
            key={c}
            className={`airport-pick big airport-${c.toLowerCase()}${airport === c ? ' on' : ''}`}
            onClick={() => setAirport(c)}
          >
            <span className="led" />
            <span className="code">{c}</span>
            <span className="odds">now {scores[race][c]}</span>
          </button>
        ))}
      </div>

      <ContextGrid>
        <ContextCell airport={airport} primary={`Line ${line}`} secondary={`Projected ~${ou.expected.toFixed(1)} · ${minsLeft}m left UTC`} />
      </ContextGrid>

      <div className="bet-section-head">SIDE</div>
      <div className="two-up big">
        <button
          className={`ou-pick big${side === 'over' ? ' on' : ''}`}
          onClick={() => setSide('over')}
        >
          <div className="lbl">OVER</div>
          <div className="v">{line}</div>
          <div className="odds">{ou.over.american}</div>
        </button>
        <button
          className={`ou-pick big${side === 'under' ? ' on' : ''}`}
          onClick={() => setSide('under')}
        >
          <div className="lbl">UNDER</div>
          <div className="v">{line}</div>
          <div className="odds">{ou.under.american}</div>
        </button>
      </div>

      <p className="bet-foot-note">Resolves at top of hour (UTC)</p>

      <StakeAndPlace
        betType="race_over_under"
        payload={{ airport, raceType: race, line, side, hourStart }}
        decimalOdds={decimal}
        americanOdds={decimalToAmerican(decimal)}
        balance={balance}
        ctaLabel={`Bet ${airport} ${side.toUpperCase()} ${line}`}
      />
    </>
  );
}

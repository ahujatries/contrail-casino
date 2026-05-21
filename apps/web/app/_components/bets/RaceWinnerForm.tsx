'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AIRPORT_CODES,
  getCurrentHourStart,
  msUntilNextHour,
  raceWinnerOdds,
  type AirportCode,
  type AllScores,
  type RaceType,
} from '@airport-pong/shared';
import { StakeAndPlace } from './StakeAndPlace';
import { ContextCell, ContextGrid, Explainer } from './NextTakeoffForm';

type Pace = Record<AirportCode, number>;

const fmtA = (a: number) => (a > 0 ? `+${a}` : `${a}`);
const decimalToAmerican = (d: number) => (d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)));

const RACE_LABEL: Record<RaceType, string> = {
  takeoff: 'Takeoff',
  heavy: 'Heavy',
  total_ops: 'Total Ops',
};

const RACE_BLURB: Record<RaceType, string> = {
  takeoff: 'Pure takeoff count — every departure registered this hour.',
  heavy: 'Heavy widebodies only (777/787/747/A330+) — landings and takeoffs combined.',
  total_ops: 'Everything moving — takeoffs + landings.',
};

export function RaceWinnerForm({
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
  const [picked, setPicked] = useState<AirportCode>('JFK');
  // SSR-safe: start with a stable fallback (60) and snap to real value after mount
  const [minsLeft, setMinsLeft] = useState(60);
  useEffect(() => {
    const update = () => setMinsLeft(Math.max(1, Math.round(msUntilNextHour() / 60_000)));
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  const paceForRace = race === 'takeoff' ? takeoffPace : race === 'heavy' ? heavyPace : totalPace;
  const odds = useMemo(
    () =>
      raceWinnerOdds({
        currentScores: scores[race],
        paceByAirport: paceForRace,
        minutesRemaining: minsLeft,
      }),
    [scores, paceForRace, minsLeft, race]
  );
  const decimal = odds[picked].decimal;
  const hourStart = getCurrentHourStart().toISOString();

  return (
    <>
      <Explainer
        bullets={[
          'Every UTC hour, 4 airports race in 3 categories simultaneously. Winner of each race = airport with the most events when the clock hits :00.',
          'Race Winner bets resolve at the top of the hour. Ties broken by who hit the score first.',
          'Odds are derived from current standings, the remaining minutes, and recent pace — they tighten as the hour progresses.',
        ]}
      />

      <div className="bet-section-head">RACE TYPE</div>
      <div className="race-tab-row">
        {(['takeoff', 'heavy', 'total_ops'] as RaceType[]).map((r) => (
          <button
            key={r}
            className={`race-tab${race === r ? ' on' : ''}`}
            onClick={() => setRace(r)}
          >
            <span className="lbl">{RACE_LABEL[r]}</span>
            <span className="sub">{RACE_BLURB[r]}</span>
          </button>
        ))}
      </div>

      <ContextGrid>
        {AIRPORT_CODES.map((c) => (
          <ContextCell
            key={c}
            airport={c}
            primary={`Score: ${scores[race][c]}`}
            secondary={`Pace ${paceForRace[c].toFixed(0)}/h · ~${(
              scores[race][c] +
              (paceForRace[c] * minsLeft) / 60
            ).toFixed(0)} projected`}
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

      <p className="bet-foot-note">Resolves at top of hour ({minsLeft}m left, UTC)</p>

      <StakeAndPlace
        betType="race_winner"
        payload={{ airport: picked, raceType: race, hourStart }}
        decimalOdds={decimal}
        americanOdds={decimalToAmerican(decimal)}
        balance={balance}
        ctaLabel={`Bet ${picked} to win the ${RACE_LABEL[race]} race`}
      />
    </>
  );
}

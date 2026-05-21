import {
  AIRPORT_CODES,
  type AirportCode,
  type AirportScores,
  type RaceType,
} from './index';

export const HOUSE_EDGE = 0.05;
/**
 * Higher temperature = more even odds across airports.
 * Bumped 6 → 10 so Race Winner odds stay competitive deeper into the hour
 * rather than collapsing once one airport opens a 10-event lead.
 */
const SOFTMAX_TEMPERATURE = 10;

export type OddsView = {
  probability: number; // 0..1, ours (no edge)
  decimal: number; // payout multiplier with house edge baked in
  american: string; // human-readable like "+150" / "-200"
  impliedHousePct: number; // for transparency
};

export const probabilityToOdds = (probability: number): OddsView => {
  const fair = clamp(probability, 0.001, 0.999);
  const payoutPerUnit = (1 / fair) * (1 - HOUSE_EDGE);
  return {
    probability: fair,
    decimal: payoutPerUnit,
    american: decimalToAmerican(payoutPerUnit),
    impliedHousePct: HOUSE_EDGE * 100,
  };
};

export const decimalToAmerican = (decimal: number): string => {
  if (decimal >= 2) {
    const v = Math.round((decimal - 1) * 100);
    return `+${v}`;
  } else {
    const v = Math.round(-100 / (decimal - 1));
    return `-${v}`;
  }
};

const softmax = (values: number[], temperature = SOFTMAX_TEMPERATURE): number[] => {
  const max = Math.max(...values);
  const exps = values.map((v) => Math.exp((v - max) / temperature));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
};

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/**
 * Race winner odds.
 * Models each airport's final score as `current + pace * minutesRemaining/60`
 * and softmaxes those projections for win probability.
 */
export const raceWinnerOdds = (input: {
  currentScores: AirportScores;
  paceByAirport: Record<AirportCode, number>;
  minutesRemaining: number;
}): Record<AirportCode, OddsView> => {
  const projections = AIRPORT_CODES.map((c) => {
    const cur = input.currentScores[c] ?? 0;
    const pace = input.paceByAirport[c] ?? 0;
    return cur + pace * (input.minutesRemaining / 60);
  });
  const probs = softmax(projections);
  const out = {} as Record<AirportCode, OddsView>;
  AIRPORT_CODES.forEach((c, i) => {
    out[c] = probabilityToOdds(probs[i]);
  });
  return out;
};

/** Over/Under final score for one airport. Uses Normal-ish CDF over expected total. */
export const raceOverUnderOdds = (input: {
  currentScore: number;
  pace: number; // per hour
  minutesRemaining: number;
  line: number;
}): { over: OddsView; under: OddsView; expected: number } => {
  const expected = input.currentScore + input.pace * (input.minutesRemaining / 60);
  // crude SD scales with remaining time / sqrt(expected); using sqrt(pace * t)
  const remainingHours = Math.max(0.05, input.minutesRemaining / 60);
  const sd = Math.max(1.2, Math.sqrt(input.pace * remainingHours));
  const z = (input.line - expected) / sd;
  const pUnder = normCdf(z);
  const pOver = 1 - pUnder;
  return {
    over: probabilityToOdds(pOver),
    under: probabilityToOdds(pUnder),
    expected,
  };
};

/** Standard normal CDF — Abramowitz & Stegun approximation. */
const normCdf = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

/** Next-event (any kind) odds by airport, from rolling-window pace. */
export const nextEventOdds = (
  paceByAirport: Record<AirportCode, number>
): Record<AirportCode, OddsView> => {
  const totalPace = AIRPORT_CODES.reduce((s, c) => s + (paceByAirport[c] ?? 0), 0);
  const out = {} as Record<AirportCode, OddsView>;
  for (const c of AIRPORT_CODES) {
    const p = totalPace > 0 ? (paceByAirport[c] ?? 0) / totalPace : 0.25;
    out[c] = probabilityToOdds(p);
  }
  return out;
};

/** Suggested over/under line for the rest of the hour. Rounded to .5. */
export const suggestedLineForHour = (currentScore: number, pace: number, minutesRemaining: number) => {
  const expected = currentScore + pace * (minutesRemaining / 60);
  return Math.round(expected) + 0.5;
};

/** Useful in resolver: did the bet win? */
export const resolveRaceOverUnder = (line: number, side: 'over' | 'under', finalScore: number): 'won' | 'lost' | 'push' => {
  if (finalScore === line) return 'push';
  const won = side === 'over' ? finalScore > line : finalScore < line;
  return won ? 'won' : 'lost';
};

'use client';

import {
  AIRPORT_COLORS,
  AIRPORT_NAMES,
  type AirportCode,
  type AllScores,
} from '@airport-pong/shared';
import { FlapNumber } from './FlapNumber';
import { CountdownClock } from './CountdownClock';

type Props = {
  airportA: AirportCode;
  airportB: AirportCode;
  scores: AllScores;
};

const RACE_LABELS = {
  takeoff: 'TAKEOFF',
  heavy: 'HEAVY',
  total_ops: 'TOTAL OPS',
} as const;

export function Hero({ airportA, airportB, scores }: Props) {
  return (
    <section className="border border-amber-500/15 bg-[#0a0a0a]">
      <header className="flex items-baseline justify-between px-6 py-3 text-[10px] tracking-[0.35em] text-amber-500/50 border-b border-amber-500/10">
        <span>FEATURED MATCHUP</span>
        <span className="hidden md:inline">RACE ENDS IN</span>
        <span className="tabular-nums text-amber-400">
          <CountdownClock />
        </span>
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 md:gap-6 px-4 md:px-12 py-8">
        <AirportColumn code={airportA} scores={scores} side="left" />
        <Spine />
        <AirportColumn code={airportB} scores={scores} side="right" />
      </div>
    </section>
  );
}

function AirportColumn({
  code,
  scores,
  side,
}: {
  code: AirportCode;
  scores: AllScores;
  side: 'left' | 'right';
}) {
  const color = AIRPORT_COLORS[code];
  const align = side === 'left' ? 'items-start text-left' : 'items-end text-right';
  return (
    <div className={`flex flex-col ${align} gap-6`}>
      <div className="flex flex-col gap-0">
        <span className="text-[10px] tracking-[0.35em] text-amber-500/60">{AIRPORT_NAMES[code]}</span>
        <span
          className="text-[72px] md:text-[120px] leading-none font-mono"
          style={{ color }}
        >
          {code}
        </span>
      </div>
      <div className={`flex flex-col gap-3 ${side === 'left' ? 'items-start' : 'items-end'}`}>
        {(['takeoff', 'heavy', 'total_ops'] as const).map((race) => (
          <div
            key={race}
            className={`flex ${side === 'left' ? 'flex-row' : 'flex-row-reverse'} items-baseline gap-3 md:gap-5`}
          >
            <FlapNumber
              value={scores[race][code] ?? 0}
              width={2}
              className="text-amber-400 text-5xl md:text-7xl font-mono"
            />
            <span className="text-[10px] md:text-xs tracking-[0.3em] text-amber-500/60">
              {RACE_LABELS[race]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Spine() {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="h-full min-h-[200px] w-px bg-amber-500/10" />
      <span className="text-amber-500/60 text-xs tracking-[0.4em]">VS</span>
      <div className="h-full min-h-[200px] w-px bg-amber-500/10" />
    </div>
  );
}

'use client';

import {
  AIRPORT_CODES,
  AIRPORT_COLORS,
  type AirportCode,
} from '@airport-pong/shared';
import { FlapNumber } from './FlapNumber';

export type TodayTotals = Record<
  AirportCode,
  { takeoff: number; landing: number; heavy: number; total: number }
>;

type Props = {
  todayTotals: TodayTotals;
  featured: [AirportCode, AirportCode];
};

export function AirportStrip({ todayTotals, featured }: Props) {
  return (
    <section className="border border-amber-500/15 bg-[#0a0a0a]">
      <header className="px-4 py-2 border-b border-amber-500/10 text-[10px] tracking-[0.35em] text-amber-500/50">
        ALL AIRPORTS · TODAY (UTC)
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4">
        {AIRPORT_CODES.map((code) => {
          const isFeatured = featured.includes(code);
          const t = todayTotals[code];
          return (
            <div
              key={code}
              className={`p-4 border-amber-500/10 ${
                isFeatured ? 'border-r border-b last:border-r-0 bg-amber-500/[0.02]' : 'border-r border-b last:border-r-0'
              }`}
            >
              <div className="flex items-baseline justify-between mb-3">
                <span
                  className="text-2xl font-mono"
                  style={{ color: AIRPORT_COLORS[code] }}
                >
                  {code}
                </span>
                {isFeatured && (
                  <span className="text-[9px] tracking-[0.3em] text-amber-400">
                    FEATURED
                  </span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px] tracking-[0.2em] text-amber-500/50">
                <Stat label="DEP" value={t.takeoff} />
                <Stat label="ARR" value={t.landing} />
                <Stat label="HVY" value={t.heavy} />
                <Stat label="TOT" value={t.total} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span>{label}</span>
      <FlapNumber
        value={value}
        width={3}
        className="text-amber-300 text-xl font-mono mt-1"
      />
    </div>
  );
}

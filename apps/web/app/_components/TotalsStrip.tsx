'use client';

import { AIRPORT_CODES, type AirportCode } from '@airport-pong/shared';

export type TodayTotals = Record<
  AirportCode,
  { takeoff: number; landing: number; heavy: number; total: number }
>;

const lc = (a: string) => a.toLowerCase();

export function TotalsStrip({
  totals,
  featured,
}: {
  totals: TodayTotals;
  featured: [AirportCode, AirportCode];
}) {
  return (
    <div className="totals-strip">
      {AIRPORT_CODES.map((a) => {
        const s = totals[a];
        const isFeatured = featured.includes(a);
        return (
          <div key={a} className={`totals-cell airport-${lc(a)}${isFeatured ? ' featured' : ''}`}>
            <div className="head">
              <span className="code">{a}</span>
              <span className="delta">{isFeatured ? 'FEATURED' : 'TRACKED'}</span>
            </div>
            <div className="row">
              <span>TO</span>
              <span className="v">{s.takeoff}</span>
            </div>
            <div className="row">
              <span>HVY</span>
              <span className="v">{s.heavy}</span>
            </div>
            <div className="row">
              <span>OPS</span>
              <span className="v">{s.total}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

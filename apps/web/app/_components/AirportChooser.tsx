'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AIRPORT_CODES,
  AIRPORT_NAMES,
  type AirportCode,
} from '@airport-pong/shared';

const ACCENT: Record<AirportCode, string> = {
  JFK: 'oklch(0.42 0.20 258)',
  ORD: 'oklch(0.52 0.20 32)',
  ATL: 'oklch(0.50 0.13 175)',
  LAX: 'oklch(0.45 0.16 305)',
};

export type ChooserCard = {
  airport: AirportCode;
  line: number;
  currentCount: number;
  inboundCount: number;
  msUntilHourEnd: number;
  locked: boolean;
};

type Props = {
  initialCards: ChooserCard[];
};

const POLL_MS = 30_000;

/**
 * Home page: 4-airport chooser. Each card shows the airport's current
 * hourly O/U line + so-far count + inbound plane count. Click → that
 * airport's betting page.
 */
export function AirportChooser({ initialCards }: Props) {
  const [cards, setCards] = useState<ChooserCard[]>(initialCards);
  const [now, setNow] = useState<number | null>(null);

  // Defer Date.now to client to avoid hydration mismatch on the countdown
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Re-poll every 30s to keep cards fresh
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const results = await Promise.all(
          AIRPORT_CODES.map(async (code) => {
            const r = await fetch(`/api/airport/${code}`, { cache: 'no-store' });
            if (!r.ok) return null;
            const d = (await r.json()) as {
              airport: AirportCode;
              hour: {
                line: number;
                currentCount: number;
                msUntilHourEnd: number;
                locked: boolean;
              };
              inbound: { icao24: string }[];
            };
            return {
              airport: d.airport,
              line: d.hour.line,
              currentCount: d.hour.currentCount,
              inboundCount: d.inbound.length,
              msUntilHourEnd: d.hour.msUntilHourEnd,
              locked: d.hour.locked,
            } as ChooserCard;
          })
        );
        if (cancelled) return;
        const next = results.filter((x): x is ChooserCard => x !== null);
        if (next.length > 0) setCards(next);
      } catch {
        // ignore — UI shows stale data, will retry
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="chooser">
      <header className="chooser-head">
        <div className="chooser-eyebrow mono">PICK YOUR AIRPORT</div>
        <h1 className="chooser-title">
          Bet OVER/UNDER on real planes. Hourly traffic or a specific landing.
        </h1>
        <p className="chooser-sub">
          Each airport runs its own hourly O/U on total ops + per-plane landing-time bets
          you build from live tracker data.
        </p>
      </header>

      <div className="chooser-grid">
        {cards.map((c) => {
          const accent = ACCENT[c.airport];
          const name = AIRPORT_NAMES[c.airport].replace(/\s*\(.*\)\s*/, '');
          const minsLeft = Math.max(0, Math.floor(c.msUntilHourEnd / 60_000));
          const pace = minsLeft < 60
            ? Math.round((c.currentCount / Math.max(1, 60 - minsLeft)) * 60)
            : c.currentCount;
          return (
            <Link
              key={c.airport}
              href={`/airport/${c.airport}`}
              className={`chooser-card airport-${c.airport.toLowerCase()}`}
              style={{ borderColor: accent }}
            >
              <div className="cc-head">
                <div className="cc-code mono" style={{ color: accent }}>{c.airport}</div>
                <div className="cc-status">
                  {c.locked ? (
                    <span className="cc-pill locked mono">LOCKED</span>
                  ) : (
                    <span className="cc-pill open mono">
                      <span className="dot" style={{ background: accent }} />
                      {minsLeft}m
                    </span>
                  )}
                </div>
              </div>
              <div className="cc-name mono">{name.toUpperCase()}</div>

              <div className="cc-stats">
                <div className="cc-stat">
                  <div className="k mono">LINE</div>
                  <div className="v" style={{ color: accent }}>{c.line}</div>
                </div>
                <div className="cc-stat">
                  <div className="k mono">SO FAR</div>
                  <div className="v">{c.currentCount}</div>
                </div>
                <div className="cc-stat">
                  <div className="k mono">PROJ</div>
                  <div className="v">{pace}</div>
                </div>
                <div className="cc-stat">
                  <div className="k mono">INBOUND</div>
                  <div className="v">{c.inboundCount}</div>
                </div>
              </div>

              <div className="cc-cta mono" style={{ color: accent }}>
                ENTER {c.airport} →
              </div>
            </Link>
          );
        })}
      </div>

      <div className="chooser-foot mono">
        UTC HOUR · LINES SET FROM 14-DAY HISTORICAL AVG · BETS LOCK AT XX:30
      </div>
    </section>
  );
}

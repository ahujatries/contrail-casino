'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AIRPORT_CODES,
  AIRPORT_NAMES,
  type AirportCode,
} from '@airport-pong/shared';

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
 * Home page: 4 airports rendered as baggage tags hanging from a string.
 * Each tag is a Link to /airport/[code]. Polls every 30s for fresh
 * line/count/inbound numbers + projection.
 */
export function AirportChooser({ initialCards }: Props) {
  const [cards, setCards] = useState<ChooserCard[]>(initialCards);
  const [now, setNow] = useState<number | null>(null);

  // Defer Date.now to client (hydration-safe countdown)
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Re-poll every 30s
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
        // ignore
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const minsLeft = cards[0] && now != null
    ? Math.max(0, Math.floor(cards[0].msUntilHourEnd / 60_000))
    : null;
  const secsLeft = cards[0] && now != null
    ? Math.max(0, Math.floor((cards[0].msUntilHourEnd % 60_000) / 1000))
    : null;

  return (
    <div className="picker-inner">
      <div className="picker-head">
        <div className="picker-kicker mono">PICK YOUR AIRPORT</div>
        <h1 className="picker-title">
          Bet OVER/UNDER on real planes.
          <br />
          Hourly traffic or a specific landing.
        </h1>
        <p className="picker-sub">
          Each airport runs its own hourly O/U on total ops, plus per-plane landing-time
          bets you build from the live inbound queue.
        </p>
      </div>

      <div className="luggage-rack">
        <div className="luggage-string" aria-hidden />
        {cards.map((c, i) => (
          <BaggageTag key={c.airport} card={c} idx={i} />
        ))}
      </div>

      <div className="picker-foot mono">
        UTC HOUR · LINES SET FROM 14-DAY HISTORICAL AVG · BETS LOCK AT XX:30
        {minsLeft != null && (
          <>
            {' · '}
            {String(minsLeft).padStart(2, '0')}:
            {String(secsLeft).padStart(2, '0')} LEFT
          </>
        )}
      </div>
    </div>
  );
}

function BaggageTag({ card, idx }: { card: ChooserCard; idx: number }) {
  const airport = card.airport;
  const name = AIRPORT_NAMES[airport].replace(/\s*\(.*\)\s*/, '');
  const minsLeft = Math.max(0, Math.floor(card.msUntilHourEnd / 60_000));
  const pace = minsLeft < 60
    ? Math.round((card.currentCount / Math.max(1, 60 - minsLeft)) * 60)
    : card.currentCount;

  return (
    <Link
      href={`/airport/${airport}`}
      className={`baggage-tag airport-${airport.toLowerCase()} tag-${idx}`}
    >
      <div className="tag-string" aria-hidden />
      <div className="tag-hole" aria-hidden />
      <div className="tag-stripe" />

      <div className="tag-head">
        <span className="tag-code">{airport}</span>
        <span className="tag-clock mono">
          {card.locked ? 'LOCKED' : `${minsLeft}m`}
        </span>
      </div>

      <div className="tag-city mono">{name.toUpperCase()}</div>

      <div className="tag-grid">
        <div className="tag-stat">
          <div className="k mono">LINE</div>
          <div className="v">{card.line}</div>
        </div>
        <div className="tag-stat">
          <div className="k mono">SO FAR</div>
          <div className="v">{card.currentCount}</div>
        </div>
        <div className="tag-stat">
          <div className="k mono">PROJ</div>
          <div className="v">{pace}</div>
        </div>
        <div className="tag-stat">
          <div className="k mono">INBOUND</div>
          <div className="v">{card.inboundCount}</div>
        </div>
      </div>

      <div className="tag-cta mono">ENTER {airport} →</div>
    </Link>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { getCurrentHourStart } from '@airport-pong/shared';

export type TickerEvent = {
  id: number;
  airport: string;
  eventType: 'takeoff' | 'landing';
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  occurredAt: string;
};

type NewsItem = {
  kind: 'news';
  id: string;
  ts: number;
  level: 'info' | 'alert';
  text: string;
};

const lc = (a: string) => a.toLowerCase();
const FRESH_MS = 6_000;
const NEWS_TTL_MS = 20_000;

export function TickerTape({ events }: { events: TickerEvent[] }) {
  // Track when each event was first seen client-side, for the alert flash.
  const firstSeenRef = useRef(new Map<number, number>());
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ─── News items computed client-side from event stream ──────────
  const [news, setNews] = useState<NewsItem[]>([]);
  const lastHourStartRef = useRef<string>(getCurrentHourStart().toISOString());
  const recentEventIdsRef = useRef(new Set<number>());

  useEffect(() => {
    // Detect hour rollover
    const cur = getCurrentHourStart().toISOString();
    if (cur !== lastHourStartRef.current) {
      lastHourStartRef.current = cur;
      pushNews(setNews, {
        kind: 'news',
        id: `hour-${cur}`,
        ts: Date.now(),
        level: 'alert',
        text: `RACE RESET · new hour started ${cur.slice(11, 16)}Z`,
      });
    }
    // Detect new heavy events
    if (events.length > 0) {
      const e = events[0];
      if (!recentEventIdsRef.current.has(e.id)) {
        recentEventIdsRef.current.add(e.id);
        if (recentEventIdsRef.current.size > 200) {
          recentEventIdsRef.current = new Set(
            Array.from(recentEventIdsRef.current).slice(-100)
          );
        }
        if (e.isHeavy) {
          pushNews(setNews, {
            kind: 'news',
            id: `heavy-${e.id}`,
            ts: Date.now(),
            level: 'alert',
            text: `HEAVY ${e.eventType.toUpperCase()} · ${e.airport} · ${e.callsign ?? e.typecode ?? 'widebody'}`,
          });
        }
      }
    }
    // Prune expired news
    setNews((prev) => prev.filter((n) => Date.now() - n.ts < NEWS_TTL_MS));
  }, [events]);

  // Tag the very newest event as the "ALERT" highlight
  const newest = events[0];
  const newestFreshAge = newest
    ? Date.now() - rememberFirstSeen(firstSeenRef.current, newest.id)
    : Infinity;
  const showAlert = newest && newestFreshAge < FRESH_MS;
  const showNews = news.length > 0;

  // The scrolling tape uses the events list (skip the newest if we're flashing
  // it in the alert slot, to avoid double-render).
  const tapeSource = showAlert ? events.slice(1) : events;
  const strand = tapeSource.length > 0 ? [...tapeSource, ...tapeSource] : [];

  // Prune firstSeen map periodically so it doesn't grow unbounded
  useEffect(() => {
    if (firstSeenRef.current.size > 500) {
      const cutoff = Date.now() - 60_000;
      for (const [k, v] of firstSeenRef.current) {
        if (v < cutoff) firstSeenRef.current.delete(k);
      }
    }
  });

  return (
    <div className="event-tape">
      <span className="label">
        <span className="pip" />
        Live feed
      </span>
      {showNews && (
        <span className={`news-slot ${news[0].level}`}>
          <span className="alert-tag">NEWS</span>
          <span className="news-text">{news[0].text}</span>
        </span>
      )}
      {showAlert && newest && !showNews && (
        <span className={`alert-slot ${newest.isHeavy ? 'heavy' : ''}`}>
          <span className="alert-tag">NEW</span>
          <TapeRow e={newest} />
        </span>
      )}
      <div className={`tape-track-wrap ${showAlert ? 'paused' : ''}`}>
        <div className="tape-track">
          {strand.length === 0 && (
            <span className="tape-event" style={{ color: 'var(--ink-3)' }}>
              Listening for events…
            </span>
          )}
          {strand.map((e, i) => {
            const seenMs = firstSeenRef.current.get(e.id) ?? 0;
            const fresh = seenMs && Date.now() - seenMs < FRESH_MS;
            return (
              <span key={`${e.id}-${i}`} className={`tape-event ${fresh && i === 0 ? 'fresh' : ''}`}>
                <TapeRow e={e} />
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TapeRow({ e }: { e: TickerEvent }) {
  const time = e.occurredAt.slice(11, 19);
  return (
    <>
      <span className="t mono">{time}</span>
      <span className={`ap ${lc(e.airport)}`}>{e.airport}</span>
      <span className="ev">{e.eventType}</span>
      <span className="cs">{e.callsign ?? '???'}</span>
      {e.typecode && (
        <>
          <span style={{ color: 'var(--ink-3)' }}>·</span>
          <span style={{ color: 'var(--ink-2)', fontSize: 10.5 }}>{e.typecode}</span>
        </>
      )}
      {e.isHeavy && <span className="heavy">HVY</span>}
    </>
  );
}

function rememberFirstSeen(map: Map<number, number>, id: number): number {
  const existing = map.get(id);
  if (existing) return existing;
  const now = Date.now();
  map.set(id, now);
  return now;
}

function pushNews(setNews: React.Dispatch<React.SetStateAction<NewsItem[]>>, item: NewsItem) {
  setNews((prev) => {
    if (prev.some((p) => p.id === item.id)) return prev;
    return [item, ...prev].slice(0, 5);
  });
}

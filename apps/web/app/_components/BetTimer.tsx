'use client';

import { useEffect, useState } from 'react';
import { msUntilNextHour, type BetPayloadByType, type BetTypeKey } from '@airport-pong/shared';

type Props = {
  betType: BetTypeKey;
  payload: unknown;
  placedAt: string; // ISO
  resolvedAt?: string | null;
  status: 'open' | 'won' | 'lost' | 'push';
};

/**
 * Compact timer line under each bet row.
 * Open bets: "placed 2m ago · resolves in 14:23 (top of hour UTC)"
 * Settled:   "placed 3m ago · resolved 1m ago"
 */
export function BetTimer({ betType, payload, placedAt, resolvedAt, status }: Props) {
  // Defer all clock-derived rendering until after hydration so SSR and the
  // first client render don't disagree.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now == null) {
    return <span className="bet-timer" suppressHydrationWarning />;
  }

  const placedAgo = formatAgo(now - new Date(placedAt).getTime());

  if (status !== 'open') {
    const resolvedAgo = resolvedAt
      ? formatAgo(now - new Date(resolvedAt).getTime())
      : null;
    return (
      <span className="bet-timer">
        <span className="placed">placed {placedAgo} ago</span>
        {resolvedAgo && (
          <>
            <span className="dot">·</span>
            <span className="resolved">resolved {resolvedAgo} ago</span>
          </>
        )}
      </span>
    );
  }

  const resolveInfo = computeResolveInfo(betType, payload, now);
  return (
    <span className="bet-timer">
      <span className="placed">placed {placedAgo} ago</span>
      <span className="dot">·</span>
      <span className={`resolves ${resolveInfo.imminent ? 'imminent' : ''}`}>
        {resolveInfo.label}
      </span>
    </span>
  );
}

type ResolveInfo = { label: string; imminent: boolean };

function computeResolveInfo(
  betType: BetTypeKey,
  payload: unknown,
  nowMs: number
): ResolveInfo {
  if (betType === 'race_winner' || betType === 'race_over_under') {
    const ms = msUntilNextHour(new Date(nowMs));
    return {
      label: `resolves in ${formatCountdown(ms)} (top of hour UTC)`,
      imminent: ms < 60_000,
    };
  }
  if (betType === 'landing_race' || betType === 'cross_airport_race') {
    const p = payload as BetPayloadByType['landing_race'] | BetPayloadByType['cross_airport_race'];
    if (p?.expectedLandingAt) {
      const ms = new Date(p.expectedLandingAt).getTime() - nowMs;
      if (ms > 0) {
        return {
          label: `lands ~${formatCountdown(ms)} (${utcHm(p.expectedLandingAt)})`,
          imminent: ms < 60_000,
        };
      }
      const lateBy = formatAgo(-ms);
      return { label: `expected landing ${lateBy} ago`, imminent: true };
    }
  }
  if (betType === 'takeoff_race') {
    return { label: 'resolves on takeoff · imminent', imminent: true };
  }
  if (betType === 'heavy_race') {
    return { label: 'resolves on next heavy', imminent: false };
  }
  if (betType === 'next_event') {
    return { label: 'resolves on next takeoff · imminent', imminent: true };
  }
  if (betType === 'next_heavy') {
    return { label: 'resolves on next heavy', imminent: false };
  }
  return { label: 'resolves on event', imminent: false };
}

const formatAgo = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const formatCountdown = (ms: number) => {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
};

const utcHm = (iso: string) => new Date(iso).toISOString().slice(11, 19) + 'Z';

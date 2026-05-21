'use client';

import { useEffect, useState } from 'react';

type Freshness = {
  liveAircraftAgeSec: number | null;
  eventsAgeSec: number | null;
};

const POLL_MS = 30_000;
const STALE_S = 300; // 5 min

export function FreshnessPill() {
  const [data, setData] = useState<Freshness | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch('/api/freshness', { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as Freshness;
        if (!cancelled) setData(j);
      } catch {
        /* ignore */
      }
    };
    void fetchOnce();
    const id = setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data) return null;

  const liveAge = data.liveAircraftAgeSec;
  const evtAge = data.eventsAgeSec;
  const oldest = Math.max(liveAge ?? 0, evtAge ?? 0);
  const stale = oldest > STALE_S;

  // Don't render anything when fresh — keep the topbar clean
  if (!stale) return null;

  const label = formatAge(oldest);
  return (
    <span
      className="freshness-pill"
      title={`Live aircraft last updated ${formatAge(liveAge ?? 0)} ago; events last updated ${formatAge(evtAge ?? 0)} ago.`}
    >
      <span className="pip" />
      DATA STALE · {label}
    </span>
  );
}

function formatAge(s: number): string {
  if (s < 90) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

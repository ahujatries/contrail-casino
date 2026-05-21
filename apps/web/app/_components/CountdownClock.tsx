'use client';

import { useEffect, useState } from 'react';
import { msUntilNextHour } from '@airport-pong/shared';

export function CountdownClock() {
  const [ms, setMs] = useState(msUntilNextHour());

  useEffect(() => {
    const i = setInterval(() => setMs(msUntilNextHour()), 1000);
    return () => clearInterval(i);
  }, []);

  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  return (
    <span className="tabular-nums">
      {mm}:{ss}
    </span>
  );
}

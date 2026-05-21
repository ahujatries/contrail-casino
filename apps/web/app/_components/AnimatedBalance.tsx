'use client';

import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 800;

export function AnimatedBalance({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (value === fromRef.current) return;
    const from = fromRef.current;
    const to = value;
    fromRef.current = value;
    startRef.current = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - (startRef.current ?? now);
      const t = Math.min(1, elapsed / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className="amount" style={{ color: 'var(--brass)' }}>
      ✈ ${shown.toLocaleString('en-US')}
    </span>
  );
}

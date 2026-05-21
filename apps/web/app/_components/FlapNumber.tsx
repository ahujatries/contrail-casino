'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  value: number;
  className?: string;
  width?: number;
};

/**
 * Number that briefly flips when it changes — Solari-board feel.
 * Uses a key change on the value to retrigger the CSS animation.
 */
export function FlapNumber({ value, className = '', width = 3 }: Props) {
  const [display, setDisplay] = useState(value);
  const [flipKey, setFlipKey] = useState(0);
  const prev = useRef(value);

  useEffect(() => {
    if (value !== prev.current) {
      prev.current = value;
      setDisplay(value);
      setFlipKey((k) => k + 1);
    }
  }, [value]);

  const padded = String(display).padStart(width, '0');

  return (
    <span className={`inline-flex items-center justify-center ${className}`}>
      {padded.split('').map((ch, i) => (
        <span
          key={`${i}-${flipKey}-${ch}`}
          className="flap inline-block tabular-nums"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

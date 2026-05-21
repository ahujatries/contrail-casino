'use client';

import { useTransition } from 'react';
import { refillBalance } from '../actions/place-bet';

export function RefillModal({
  open,
  onRefilled,
}: {
  open: boolean;
  onRefilled: (newBalance: number) => void;
}) {
  const [pending, startTransition] = useTransition();
  if (!open) return null;

  const refill = () => {
    startTransition(async () => {
      const r = await refillBalance();
      if (r.ok) onRefilled(r.balance);
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card cage">
        <div
          style={{
            fontFamily: 'var(--font-wordmark), Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 700,
            fontSize: 22,
            color: 'var(--brass)',
            letterSpacing: '0.005em',
          }}
        >
          The Cage
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--neg)',
            textTransform: 'uppercase',
          }}
        >
          Empty tank · zero chips
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 36,
            color: 'var(--ink-0)',
          }}
        >
          ✈ $0
        </div>
        <p style={{ color: 'var(--ink-1)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          The house has comped you a fresh ✈ $10,000. Cash out at the cage and get back to
          the floor — this is a game, not a debt simulator.
        </p>
        <button className="place-btn" onClick={refill} disabled={pending}>
          {pending ? 'Re-comping…' : 'Take the comp · ✈ $10,000'}
        </button>
      </div>
    </div>
  );
}

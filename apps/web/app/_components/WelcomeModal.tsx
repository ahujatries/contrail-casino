'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'ap_welcomed_v2';

export function WelcomeModal({ callsign }: { callsign: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);
  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setOpen(false);
  };
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
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
          Contrail Casino
        </div>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.3em',
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
          }}
        >
          Welcome aboard — you've been comped
        </div>
        <div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: '0.25em',
              color: 'var(--ink-3)',
              textTransform: 'uppercase',
            }}
          >
            Your callsign
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 28,
              color: 'var(--ink-0)',
              marginTop: 4,
            }}
          >
            {callsign}
          </div>
        </div>
        <p style={{ color: 'var(--ink-1)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          Welcome to the floor. You start with <span style={{ color: 'var(--brass)' }}>✈ $10,000</span>{' '}
          in play money. Bet on which of JFK / ORD / ATL / LAX wins the live aviation
          races. Real planes, hourly windows, no real currency anywhere.
        </p>
        <ul
          style={{
            fontSize: 12,
            color: 'var(--ink-2)',
            lineHeight: 1.6,
            margin: 0,
            paddingLeft: 16,
          }}
        >
          <li>QUICK bets resolve in seconds (next takeoff / next heavy)</li>
          <li>RACE bets resolve at the top of the hour</li>
          <li>Stakes ✈$10 – ✈$1,000 · house edge 5%</li>
          <li>Bottom out at $0 → refill to ✈$10,000</li>
        </ul>
        <button className="place-btn" onClick={close}>
          Enter
        </button>
        <p
          style={{
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            textAlign: 'center',
            margin: 0,
          }}
        >
          not gambling · no real money · no deposits or withdrawals
        </p>
      </div>
    </div>
  );
}

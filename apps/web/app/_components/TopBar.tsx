'use client';

import { useEffect, useState } from 'react';
import { AnimatedBalance } from './AnimatedBalance';

type Props = {
  callsign: string;
  balance: number;
  active?: 'home' | 'tracker' | 'leaderboard' | 'bets' | 'about';
};

export function TopBar({ callsign, balance, active = 'home' }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="topbar">
      <a href="/" className="brand">
        <span className="dot" />
        <span className="glyph">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M2 12l8-2 4-8 2 1-2 8 6 3-1 2-6-2-3 5-1.5-.5 1-5L4 13z"
              fill="currentColor"
              stroke="none"
            />
          </svg>
        </span>
        <span className="wordmark">
          <span className="primary">Contrail</span>
          <span className="sep">·</span>
          <span className="secondary">Casino</span>
        </span>
      </a>
      <nav className="nav">
        <a className={active === 'home' ? 'active' : ''} href="/">Home</a>
        <a className={active === 'tracker' ? 'active' : ''} href="/tracker">Tracker</a>
        <a className={active === 'leaderboard' ? 'active' : ''} href="/leaderboard">Leaderboard</a>
        <a className={active === 'bets' ? 'active' : ''} href="/bets">Your Bets</a>
        <a className={active === 'about' ? 'active' : ''} href="/about">About</a>
      </nav>
      <div className="topbar-right">
        <span
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--ink-3)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          UTC {now ? now.toISOString().slice(11, 19) : '--:--:--'}
        </span>
        <div className="callsign">
          <span className="you">YOU</span>
          {callsign}
        </div>
        <div className="balance">
          <span className="label">Balance</span>
          <AnimatedBalance value={balance} />
        </div>
      </div>
    </header>
  );
}

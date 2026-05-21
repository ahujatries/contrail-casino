'use client';

import { useEffect, useState } from 'react';
import { FreshnessPill } from './FreshnessPill';

type Route = 'home' | 'bets' | 'bet' | 'tracker' | 'leaderboard' | 'your-bets' | 'about';

type Props = {
  callsign: string;
  balance: number;
  active?: Route;
};

const fmtMoney = (n: number) => Math.round(n).toLocaleString('en-US');

export function TopBar({ callsign, balance, active = 'home' }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const utc = now ? now.toISOString().slice(11, 19) : '--:--:--';

  return (
    <header className="topbar">
      <a className="brand" href="/">
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
        AIRPORT PONG
      </a>
      <nav className="nav">
        <a className={active === 'home' ? 'active' : ''} href="/">Live</a>
        <a className={active === 'bets' || active === 'bet' ? 'active' : ''} href="/bet">Bet Types</a>
        <a className={active === 'tracker' ? 'active' : ''} href="/tracker">Tracker</a>
        <a className={active === 'leaderboard' ? 'active' : ''} href="/leaderboard">Board</a>
        <a className={active === 'your-bets' ? 'active' : ''} href="/bets">Your Bets</a>
        <a className={active === 'about' ? 'active' : ''} href="/about">About</a>
      </nav>
      <div className="topbar-right">
        <FreshnessPill />
        <span className="mono utc-clock">UTC {utc}</span>
        <div className="callsign">
          <span className="you">YOU</span>
          {callsign}
        </div>
        <div className="balance">
          <span className="label">Balance</span>
          <span className="amount">✈ ${fmtMoney(balance)}</span>
        </div>
      </div>
    </header>
  );
}

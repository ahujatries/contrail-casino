'use client';

import { type ReactNode } from 'react';
import { ActiveBets, type ActiveBet } from '../ActiveBets';

type Props = {
  eyebrow: string;
  title: string;
  blurb: string;
  bets: ActiveBet[];
  children: ReactNode;
};

export function BetPageShell({ eyebrow, title, blurb, bets, children }: Props) {
  return (
    <div className="bet-page">
      <div className="bet-page-head">
        <a href="/" className="bet-back">
          ← Back to live
        </a>
        <div className="bet-page-eyebrow">{eyebrow}</div>
        <h1 className="bet-page-title">{title}</h1>
        <p className="bet-page-blurb">{blurb}</p>
      </div>
      <div className="bet-page-body">
        <div className="bet-page-form">{children}</div>
        <aside className="bet-page-side">
          <ActiveBets bets={bets} />
          <a href="/bet" className="bet-other-link">
            ← All bet types
          </a>
        </aside>
      </div>
    </div>
  );
}

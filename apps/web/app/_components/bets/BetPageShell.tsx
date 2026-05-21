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
    <main className="screen screen-detail">
      <div className="screen-inner">
        <a href="/bet" className="back-link mono">← All bet types</a>
        <div className="screen-head">
          <div>
            <div className="micro mono screen-kicker">{eyebrow}</div>
            <h1 className="screen-title">{title}</h1>
            <p className="screen-sub">{blurb}</p>
          </div>
        </div>
        <div className="detail-grid">
          <div className="detail-config">{children}</div>
          <aside className="detail-sidebar">
            <div className="ds-card">
              <ActiveBets bets={bets} />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

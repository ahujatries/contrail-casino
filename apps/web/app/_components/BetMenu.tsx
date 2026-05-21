'use client';

import { ActiveBets, type ActiveBet } from './ActiveBets';
import { BET_MENU } from '../../lib/bet-menu';

export function BetMenu({ bets }: { bets: ActiveBet[] }) {
  return (
    <aside className="bets">
      <div className="bets-head">
        <div className="title">Place a bet</div>
      </div>
      <div className="bet-body">
        <div className="bet-menu-list">
          {BET_MENU.map((b) =>
            b.live ? (
              <a key={b.slug} href={`/bet/${b.slug}`} className="bet-menu-row">
                <div className="lbl">
                  <span className="name">{b.label}</span>
                  <span className="resolves">~{b.resolves}</span>
                </div>
                <div className="blurb">{b.blurb}</div>
              </a>
            ) : (
              <div key={b.slug} className="bet-menu-row soon">
                <div className="lbl">
                  <span className="name">{b.label}</span>
                  <span className="badge">SOON</span>
                </div>
                <div className="blurb">{b.blurb}</div>
              </div>
            )
          )}
          <a href="/bet" className="bet-menu-all">
            See all bet types →
          </a>
        </div>

        <ActiveBets bets={bets} />
      </div>
    </aside>
  );
}

'use client';

import {
  AIRPORT_COLORS,
  describeBet,
  type BetPayloadByType,
  type BetTypeKey,
} from '@airport-pong/shared';
import { BetTimer } from './BetTimer';

export type ActiveBet = {
  id: number;
  betType: string;
  betPayload: unknown;
  stake: number;
  potentialPayout: number;
  status: 'open' | 'won' | 'lost' | 'push';
  placedAt: string;
  resolvedAt: string | null;
};

const fmtMoney = (n: number) => Math.round(n).toLocaleString('en-US');

export function ActiveBets({ bets }: { bets: ActiveBet[] }) {
  const open = bets.filter((b) => b.status === 'open');
  const recent = bets.filter((b) => b.status !== 'open').slice(0, 5);
  return (
    <div className="ds-active-bets">
      <div className="yb-head mono" style={{ marginBottom: 8 }}>
        <span>YOUR BETS</span>
        <span className="yb-count">
          {open.length} OPEN · {recent.length} RECENT
        </span>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bets.length === 0 && (
          <li
            style={{
              padding: '20px 12px',
              textAlign: 'center',
              fontSize: 11,
              color: 'var(--ink-3)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.1em',
            }}
          >
            No bets yet. Place one →
          </li>
        )}
        {open.map((b) => (
          <BetRow key={b.id} bet={b} />
        ))}
        {recent.map((b) => (
          <BetRow key={b.id} bet={b} />
        ))}
      </ul>
    </div>
  );
}

function BetRow({ bet }: { bet: ActiveBet }) {
  const label = (() => {
    try {
      return describeBet(
        bet.betType as BetTypeKey,
        bet.betPayload as BetPayloadByType[BetTypeKey]
      );
    } catch {
      return bet.betType;
    }
  })();
  const airport = (bet.betPayload as { airport?: string })?.airport;
  const accent = airport && AIRPORT_COLORS[airport as keyof typeof AIRPORT_COLORS];
  return (
    <li className={`active-bet-row ${bet.status}`}>
      <div className="ab-line">
        <span className="ab-label">{label}</span>
        <StatusPill status={bet.status} payout={bet.potentialPayout} stake={bet.stake} />
      </div>
      <BetTimer
        betType={bet.betType as BetTypeKey}
        payload={bet.betPayload}
        placedAt={bet.placedAt}
        resolvedAt={bet.resolvedAt}
        status={bet.status}
      />
      <div className="ab-money mono">
        <span>
          {accent && <span className="ab-dot" style={{ background: accent }} />}
          risk ✈ ${fmtMoney(bet.stake)}
        </span>
        <span>
          {bet.status === 'open'
            ? `to win ✈ $${fmtMoney(bet.potentialPayout)}`
            : bet.status === 'won'
              ? `+✈ $${fmtMoney(bet.potentialPayout - bet.stake)}`
              : bet.status === 'lost'
                ? `-✈ $${fmtMoney(bet.stake)}`
                : 'push'}
        </span>
      </div>
    </li>
  );
}

function StatusPill({
  status,
  payout,
  stake,
}: {
  status: ActiveBet['status'];
  payout: number;
  stake: number;
}) {
  if (status === 'open') {
    return (
      <span className="ab-pill open">
        <span className="ab-pip" /> OPEN
      </span>
    );
  }
  if (status === 'won') {
    return <span className="ab-pill won">WON +{fmtMoney(payout - stake)}</span>;
  }
  if (status === 'lost') {
    return <span className="ab-pill lost">LOST</span>;
  }
  return <span className="ab-pill push">PUSH</span>;
}

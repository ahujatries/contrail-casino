'use client';

import { AIRPORT_COLORS, describeBet, type BetPayloadByType, type BetTypeKey } from '@airport-pong/shared';

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

export function ActiveBets({ bets }: { bets: ActiveBet[] }) {
  const open = bets.filter((b) => b.status === 'open');
  const recent = bets.filter((b) => b.status !== 'open').slice(0, 5);

  return (
    <section className="border border-amber-500/15 bg-[#0a0a0a]">
      <header className="px-4 py-2 border-b border-amber-500/10 text-[10px] tracking-[0.35em] text-amber-500/60 flex items-baseline justify-between">
        <span>YOUR BETS</span>
        <span className="text-amber-500/40">
          {open.length} OPEN · {recent.length} RECENT
        </span>
      </header>
      <ul className="divide-y divide-amber-500/5 max-h-[420px] overflow-y-auto">
        {bets.length === 0 && (
          <li className="px-4 py-6 text-center text-[11px] text-amber-500/40">
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
    </section>
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
    <li className="px-4 py-2.5 flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] text-amber-200 leading-tight">{label}</span>
        <StatusPill status={bet.status} payout={bet.potentialPayout} />
      </div>
      <div className="flex items-baseline justify-between text-[10px] text-amber-500/40 font-mono tabular-nums">
        <span>
          {accent && (
            <span className="inline-block w-1.5 h-1.5 mr-1.5 rounded-full" style={{ background: accent }} />
          )}
          risk ✈️${bet.stake}
        </span>
        <span>
          {bet.status === 'open'
            ? `to win ✈️$${bet.potentialPayout}`
            : bet.status === 'won'
              ? `+✈️$${bet.potentialPayout - bet.stake}`
              : bet.status === 'lost'
                ? `-✈️$${bet.stake}`
                : 'push'}
        </span>
      </div>
    </li>
  );
}

function StatusPill({
  status,
  payout,
}: {
  status: ActiveBet['status'];
  payout: number;
}) {
  if (status === 'open') {
    return (
      <span className="text-[9px] tracking-[0.3em] text-amber-400 flex items-center gap-1">
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
        OPEN
      </span>
    );
  }
  if (status === 'won') {
    return (
      <span className="text-[9px] tracking-[0.3em] text-emerald-300 font-mono">
        WON +{payout}
      </span>
    );
  }
  if (status === 'lost') {
    return <span className="text-[9px] tracking-[0.3em] text-red-300/70">LOST</span>;
  }
  return <span className="text-[9px] tracking-[0.3em] text-amber-500/50">PUSH</span>;
}

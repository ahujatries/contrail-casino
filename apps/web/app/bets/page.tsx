import { getRecentBetsForUser, type ActiveBetRow } from '@airport-pong/db';
import {
  describeBet,
  type BetPayloadByType,
  type BetTypeKey,
} from '@airport-pong/shared';
import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';

export const dynamic = 'force-dynamic';

export default async function BetsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="page-shell">
        <div className="container">Setting up your callsign… refresh.</div>
      </main>
    );
  }
  const rows: ActiveBetRow[] = await getRecentBetsForUser(user.id, 100);
  const open = rows.filter((b) => b.status === 'open');
  const settled = rows.filter((b) => b.status !== 'open');
  const wins = settled.filter((b) => b.status === 'won');
  const losses = settled.filter((b) => b.status === 'lost');
  const grossProfit = wins.reduce((s, b) => s + (b.potentialPayout - b.stake), 0);
  const grossLoss = losses.reduce((s, b) => s + b.stake, 0);
  const net = grossProfit - grossLoss;

  return (
    <div
      style={{
        height: '100vh',
        display: 'grid',
        gridTemplateRows: '56px 1fr',
        background: 'var(--bg-0)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <TopBar callsign={user.callsign} balance={user.balance} active="bets" />
      <main className="page-shell" style={{ overflow: 'auto', padding: '32px 24px' }}>
        <div className="container">
          <h1 style={{ fontSize: 28, color: 'var(--ink-0)', margin: '0 0 24px' }}>
            Your bets
          </h1>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              marginBottom: 24,
            }}
          >
            <Stat label="OPEN" value={open.length} />
            <Stat label="W / L" value={`${wins.length} / ${losses.length}`} />
            <Stat
              label="NET P/L"
              value={`${net >= 0 ? '+' : ''}✈$${net.toLocaleString('en-US')}`}
              tone={net >= 0 ? 'pos' : 'neg'}
            />
            <Stat label="BALANCE" value={`✈$${user.balance.toLocaleString('en-US')}`} />
          </div>
          <Section title={`OPEN · ${open.length}`} bets={open} />
          <Section title={`SETTLED · ${settled.length}`} bets={settled} />
        </div>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'pos' | 'neg';
}) {
  const color = tone === 'pos' ? 'var(--pos)' : tone === 'neg' ? 'var(--neg)' : 'var(--ink-0)';
  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--bg-1)',
        border: '0.5px solid var(--line-soft)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.2em',
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
          fontSize: 20,
          marginTop: 6,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Section({ title, bets }: { title: string; bets: ActiveBetRow[] }) {
  if (bets.length === 0) return null;
  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.22em',
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: 'none',
          border: '0.5px solid var(--line)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-1)',
          overflow: 'hidden',
        }}
      >
        {bets.map((b) => {
          const label = (() => {
            try {
              return describeBet(
                b.betType as BetTypeKey,
                b.betPayload as BetPayloadByType[BetTypeKey]
              );
            } catch {
              return b.betType;
            }
          })();
          const placed = b.placedAt.toISOString().replace('T', ' ').slice(0, 16);
          const net =
            b.status === 'won'
              ? b.potentialPayout - b.stake
              : b.status === 'lost'
                ? -b.stake
                : 0;
          const statusColor =
            b.status === 'open'
              ? 'var(--accent)'
              : b.status === 'won'
                ? 'var(--pos)'
                : b.status === 'lost'
                  ? 'var(--neg)'
                  : 'var(--ink-3)';
          return (
            <li
              key={b.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: 16,
                padding: '10px 14px',
                borderBottom: '0.5px solid var(--line-soft)',
                alignItems: 'baseline',
              }}
            >
              <div>
                <div style={{ color: 'var(--ink-0)', fontSize: 13 }}>{label}</div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 10.5,
                    color: 'var(--ink-3)',
                    marginTop: 3,
                  }}
                >
                  {placed}Z · risk ✈${b.stake}
                </div>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10.5,
                  letterSpacing: '0.2em',
                  color: statusColor,
                }}
              >
                {b.status.toUpperCase()}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 13,
                  color:
                    net > 0 ? 'var(--pos)' : net < 0 ? 'var(--neg)' : 'var(--ink-3)',
                }}
              >
                {net > 0 ? '+' : ''}
                {net !== 0 ? `✈$${Math.abs(net)}` : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

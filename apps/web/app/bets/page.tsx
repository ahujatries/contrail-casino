import { getRecentBetsForUser, type ActiveBetRow } from '@airport-pong/db';
import {
  describeBet,
  type BetPayloadByType,
  type BetTypeKey,
} from '@airport-pong/shared';
import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';

export const dynamic = 'force-dynamic';

const fmtMoney = (n: number) => Math.round(n).toLocaleString('en-US');

export default async function BetsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="screen">
        <div className="screen-inner">Setting up your callsign… refresh.</div>
      </main>
    );
  }
  const rows: ActiveBetRow[] = await getRecentBetsForUser(user.id, 100);
  const open = rows.filter((b) => b.status === 'open');
  const settled = rows.filter((b) => b.status !== 'open');
  const wins = settled.filter((b) => b.status === 'won');
  const losses = settled.filter((b) => b.status === 'lost');
  const totalRisk = open.reduce((s, b) => s + b.stake, 0);
  const totalPotential = open.reduce((s, b) => s + b.potentialPayout, 0);

  return (
    <div className="app" data-route="your-bets">
      <TopBar callsign={user.callsign} balance={user.balance} active="your-bets" />
      <main className="screen screen-bets-history">
        <div className="screen-inner">
          <div className="screen-head">
            <div>
              <div className="micro mono screen-kicker">OPEN POSITIONS · SETTLED TODAY</div>
              <h1 className="screen-title">Your Bets</h1>
              <p className="screen-sub">
                Track bets in flight and review settled bets. Times shown in UTC.
              </p>
            </div>
          </div>

          <div className="yb-summary">
            <Cell k="OPEN" v={String(open.length)} />
            <Cell k="AT RISK" v={`✈ $${fmtMoney(totalRisk)}`} />
            <Cell k="POTENTIAL WIN" v={`✈ $${fmtMoney(totalPotential)}`} win />
            <Cell k="BALANCE" v={`✈ $${fmtMoney(user.balance)}`} />
          </div>

          <h2 className="yb-section mono">OPEN · {open.length}</h2>
          <table className="yb-table">
            <thead>
              <tr>
                <th>BET</th>
                <th>DESCRIPTION</th>
                <th className="num">RISK</th>
                <th className="num">TO WIN</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {open.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty mono">
                    No open bets. <a href="/bet">Browse bet types →</a>
                  </td>
                </tr>
              )}
              {open.map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="yb-tag mono">{b.betType.replace(/_/g, ' ').toUpperCase()}</span>
                  </td>
                  <td>{describeSafe(b)}</td>
                  <td className="num mono">✈ ${fmtMoney(b.stake)}</td>
                  <td className="num mono win">✈ ${fmtMoney(b.potentialPayout)}</td>
                  <td>
                    <span className="yb-status open mono">● OPEN</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2 className="yb-section mono">SETTLED · {settled.length} (W {wins.length} / L {losses.length})</h2>
          <table className="yb-table">
            <thead>
              <tr>
                <th>BET</th>
                <th>DESCRIPTION</th>
                <th className="num">RISK</th>
                <th className="num">RESULT</th>
                <th>TIME</th>
              </tr>
            </thead>
            <tbody>
              {settled.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty mono">
                    No settled bets yet.
                  </td>
                </tr>
              )}
              {settled.map((b) => {
                const net =
                  b.status === 'won'
                    ? b.potentialPayout - b.stake
                    : b.status === 'lost'
                      ? -b.stake
                      : 0;
                const t = (b.resolvedAt ?? b.placedAt).toISOString().slice(11, 16);
                return (
                  <tr key={b.id}>
                    <td>
                      <span className="yb-tag mono">{b.betType.replace(/_/g, ' ').toUpperCase()}</span>
                    </td>
                    <td>{describeSafe(b)}</td>
                    <td className="num mono">✈ ${fmtMoney(b.stake)}</td>
                    <td className={`num mono ${net >= 0 ? 'win' : 'lose'}`}>
                      {net > 0 ? '+' : ''}✈ ${fmtMoney(Math.abs(net))}
                    </td>
                    <td className="mono">UTC {t}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
      <footer style={{ height: 44, borderTop: '0.5px solid var(--line)', background: 'var(--bg-1)' }} />
    </div>
  );
}

function Cell({ k, v, win = false }: { k: string; v: string; win?: boolean }) {
  return (
    <div className="yb-summary-cell">
      <div className="k mono">{k}</div>
      <div className={`v ${win ? 'win' : ''}`}>{v}</div>
    </div>
  );
}

function describeSafe(b: ActiveBetRow): string {
  try {
    return describeBet(b.betType as BetTypeKey, b.betPayload as BetPayloadByType[BetTypeKey]);
  } catch {
    return b.betType;
  }
}

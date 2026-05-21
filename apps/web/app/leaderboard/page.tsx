import { getLeaderboard } from '@airport-pong/db';
import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const [rows, user] = await Promise.all([getLeaderboard(100), getCurrentUser()]);
  return (
    <div className="app" data-route="leaderboard">
      <TopBar callsign={user?.callsign ?? '—'} balance={user?.balance ?? 0} active="leaderboard" />
      <main className="screen screen-leaderboard">
        <div className="screen-inner">
          <div className="screen-head">
            <div>
              <div className="micro mono screen-kicker">ALL TIME · TOP 100</div>
              <h1 className="screen-title">Leaderboard</h1>
              <p className="screen-sub">
                Top bettors by current balance. Weekly leaderboard resets at 00:00 UTC
                Monday.
              </p>
            </div>
          </div>

          <table className="lb-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>HANDLE</th>
                <th className="num">BALANCE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const you = user?.callsign === r.callsign;
                const rank = i + 1;
                return (
                  <tr key={r.callsign} className={you ? 'you' : ''}>
                    <td className="rank">
                      {rank <= 3 ? (
                        <span className={`medal m${rank}`}>#{rank}</span>
                      ) : (
                        <span className="mono">#{rank}</span>
                      )}
                    </td>
                    <td className="handle">
                      {r.callsign}
                      {you && <span className="you-tag mono">YOU</span>}
                    </td>
                    <td className="num mono win">✈ ${r.balance.toLocaleString('en-US')}</td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--ink-3)' }}>
                    No callsigns yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
      <footer style={{ height: 44, borderTop: '0.5px solid var(--line)', background: 'var(--bg-1)' }} />
    </div>
  );
}

import { getLeaderboard } from '@airport-pong/db';
import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const [rows, user] = await Promise.all([getLeaderboard(100), getCurrentUser()]);
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
      <TopBar
        callsign={user?.callsign ?? '—'}
        balance={user?.balance ?? 0}
        active="leaderboard"
      />
      <main className="page-shell" style={{ overflow: 'auto', padding: '32px 24px' }}>
        <div className="container">
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <h1 style={{ fontSize: 28, color: 'var(--ink-0)', margin: 0 }}>Leaderboard</h1>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.2em',
                color: 'var(--ink-3)',
                textTransform: 'uppercase',
              }}
            >
              Top 100 · all-time
            </span>
          </div>
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              border: '0.5px solid var(--line)',
              borderRadius: 'var(--radius-md)',
              background: 'oklch(0.18 0.018 250)',
              overflow: 'hidden',
            }}
          >
            {rows.map((r, i) => {
              const isYou = user?.callsign === r.callsign;
              return (
                <li
                  key={r.callsign}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '52px 1fr auto',
                    gap: 16,
                    padding: '10px 16px',
                    background: isYou ? 'oklch(0.24 0.018 250)' : 'transparent',
                    borderBottom: '0.5px solid var(--line-soft)',
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 13,
                    color: 'var(--ink-1)',
                  }}
                >
                  <span style={{ color: 'var(--ink-3)' }}>
                    {String(i + 1).padStart(3, '0')}
                  </span>
                  <span style={{ color: isYou ? 'var(--ink-0)' : 'var(--ink-1)' }}>
                    {r.callsign}
                    {isYou && (
                      <span
                        style={{
                          fontSize: 9.5,
                          marginLeft: 10,
                          color: 'var(--accent)',
                          letterSpacing: '0.2em',
                        }}
                      >
                        YOU
                      </span>
                    )}
                  </span>
                  <span style={{ color: 'var(--ink-0)' }}>
                    ✈ ${r.balance.toLocaleString('en-US')}
                  </span>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--ink-3)',
                  fontSize: 12,
                }}
              >
                No callsigns yet.
              </li>
            )}
          </ol>
        </div>
      </main>
    </div>
  );
}

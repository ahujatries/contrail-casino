import { getActiveBetsForUser } from '@airport-pong/db';
import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';
import { ActiveBets, type ActiveBet } from '../_components/ActiveBets';
import { BET_MENU } from '../../lib/bet-menu';

export const dynamic = 'force-dynamic';

export default async function BetIndexPage() {
  const user = await getCurrentUser();
  const userBets = user ? await getActiveBetsForUser(user.id) : [];
  const bets: ActiveBet[] = userBets.map((b) => ({
    id: b.id,
    betType: b.betType,
    betPayload: b.betPayload,
    stake: b.stake,
    potentialPayout: b.potentialPayout,
    status: b.status,
    placedAt: b.placedAt.toISOString(),
    resolvedAt: b.resolvedAt ? b.resolvedAt.toISOString() : null,
  }));

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
      <TopBar callsign={user?.callsign ?? '—'} balance={user?.balance ?? 0} active="bets" />
      <main className="page-shell" style={{ overflow: 'auto', padding: '32px 24px' }}>
        <div className="container">
          <a href="/" className="bet-back">← Back to live</a>
          <h1 style={{ fontSize: 28, color: 'var(--ink-0)', margin: '12px 0 6px' }}>
            Bet types
          </h1>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '0 0 28px' }}>
            Each bet has its own page with the live data you need to make the call. All times UTC.
          </p>
          <div className="bet-index-grid">
            {BET_MENU.map((b) => (
              <a
                key={b.slug}
                href={b.live ? `/bet/${b.slug}` : '#'}
                className={`bet-index-card${b.live ? '' : ' soon'}`}
                aria-disabled={!b.live}
              >
                <div className="title">
                  {b.label}
                  {!b.live && <span className="badge">SOON</span>}
                </div>
                <div className="blurb">{b.blurb}</div>
                <div className="resolves">Resolves: {b.resolves}</div>
              </a>
            ))}
          </div>
          <div style={{ marginTop: 40 }}>
            <ActiveBets bets={bets} />
          </div>
        </div>
      </main>
    </div>
  );
}

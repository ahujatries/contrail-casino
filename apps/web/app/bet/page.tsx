import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';
import { BET_MENU } from '../../lib/bet-menu';

export const dynamic = 'force-dynamic';

export default async function BetIndexPage() {
  const user = await getCurrentUser();

  return (
    <div className="app" data-route="bets">
      <TopBar callsign={user?.callsign ?? '—'} balance={user?.balance ?? 0} active="bets" />
      <main className="screen screen-bets">
        <div className="screen-inner">
          <div className="screen-head">
            <div>
              <div className="micro mono screen-kicker">ALL · WHAT TO BET ON</div>
              <h1 className="screen-title">Bet Types</h1>
              <p className="screen-sub">
                Eight ways to bet on real air-traffic events at JFK, ORD, ATL and LAX. Each
                card opens a live detail page with current data and odds.
              </p>
            </div>
          </div>

          <ul className="bet-type-grid">
            {BET_MENU.map((b) => (
              <li key={b.slug}>
                {b.live ? (
                  <a href={`/bet/${b.slug}`} className="bet-type-card">
                    <div className="btc-head">
                      <h3 className="btc-title">{b.label}</h3>
                      <span className="btc-timing mono">~{b.resolves.toUpperCase()}</span>
                    </div>
                    <div className="btc-tag mono">{cardTag(b.slug)}</div>
                    <p className="btc-desc">{b.blurb}</p>
                    <div className="btc-cta">
                      <span className="mono">PLACE BET</span>
                      <span className="btc-arrow">→</span>
                    </div>
                  </a>
                ) : (
                  <div className="bet-type-card" style={{ opacity: 0.55, cursor: 'not-allowed' }}>
                    <div className="btc-head">
                      <h3 className="btc-title">{b.label}</h3>
                      <span className="btc-timing mono">SOON</span>
                    </div>
                    <div className="btc-tag mono">{cardTag(b.slug)}</div>
                    <p className="btc-desc">{b.blurb}</p>
                    <div className="btc-cta">
                      <span className="mono">COMING SOON</span>
                      <span className="btc-arrow">·</span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
      <footer style={{ height: 44, borderTop: '0.5px solid var(--line)', background: 'var(--bg-1)' }} />
    </div>
  );
}

function cardTag(slug: string): string {
  if (slug.endsWith('-race')) return 'HEAD-TO-HEAD';
  if (slug.startsWith('next-')) return 'PICK ONE OF 4';
  if (slug.startsWith('race-')) return 'HOURLY';
  return 'TABLE';
}

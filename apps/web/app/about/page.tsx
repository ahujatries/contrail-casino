import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';

export const dynamic = 'force-dynamic';

export default async function AboutPage() {
  const user = await getCurrentUser();
  return (
    <div className="app" data-route="about">
      <TopBar callsign={user?.callsign ?? '—'} balance={user?.balance ?? 0} active="about" />
      <main className="screen screen-about">
        <div className="screen-inner about-inner">
          <div className="screen-head">
            <div>
              <div className="micro mono screen-kicker">ABOUT · HOW IT WORKS</div>
              <h1 className="screen-title">Real flights. Real odds. Real fast.</h1>
              <p className="screen-sub">
                Airport Pong lets you bet on live air-traffic events at four major US
                airports. Every bet resolves against actual aircraft movements — no models,
                no spreads, no waiting.
              </p>
            </div>
          </div>

          <div className="about-grid">
            <section className="about-step">
              <div className="about-num mono">01</div>
              <h3>Pick a bet type</h3>
              <p>
                Eight live markets, from a 30-second "next takeoff" to a full-hour race
                winner. Head-to-head matchups, single-airport picks, and over/under lines.
              </p>
            </section>
            <section className="about-step">
              <div className="about-num mono">02</div>
              <h3>Place your stake</h3>
              <p>
                Minimum ✈$10, maximum ✈$1,000. Odds are derived from rolling pace at each
                airport with a 5% house edge. Busier airports get shorter odds.
              </p>
            </section>
            <section className="about-step">
              <div className="about-num mono">03</div>
              <h3>Watch it settle</h3>
              <p>
                Bets resolve as soon as the event happens — sometimes seconds, sometimes
                up to an hour. Pushes refund your stake. Balance updates instantly.
              </p>
            </section>
          </div>

          <div className="about-stats">
            {(
              [
                ['4', 'AIRPORTS TRACKED'],
                ['8', 'BET TYPES'],
                ['15s', 'DATA REFRESH'],
                ['5%', 'HOUSE EDGE'],
              ] as Array<[string, string]>
            ).map(([v, k]) => (
              <div key={k} className="about-stat">
                <div className="about-stat-v">{v}</div>
                <div className="about-stat-k mono">{k}</div>
              </div>
            ))}
          </div>

          <div className="about-rules">
            <h3>House rules</h3>
            <ul>
              <li>All times are UTC. Hourly markets close at the top of the hour.</li>
              <li>A "heavy" is any 777, 787, A330+ widebody.</li>
              <li>If a bet pushes (exactly the line for O/U), your stake is refunded.</li>
              <li>Hit ✈$0 and the cage comps you back to ✈$10,000.</li>
              <li>Play money only — no real currency, no deposits, no withdrawals.</li>
              <li>
                Aviation data via{' '}
                <a
                  href="https://opensky-network.org"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--accent)' }}
                >
                  OpenSky Network
                </a>
                . Map tiles via Mapbox.
              </li>
            </ul>
          </div>
        </div>
      </main>
      <footer style={{ height: 44, borderTop: '0.5px solid var(--line)', background: 'var(--bg-1)' }} />
    </div>
  );
}

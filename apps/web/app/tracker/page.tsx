import { eq } from 'drizzle-orm';
import {
  getCurrentHourScores,
  getDb,
  getNextLandingForAirport,
  getNextTakeoffForAirport,
  getPaceByAirport,
  liveAircraft,
} from '@airport-pong/db';
import { AIRPORT_CODES, AIRPORT_NAMES, type AirportCode } from '@airport-pong/shared';
import { getCurrentUser } from '../../lib/session';
import { TopBar } from '../_components/TopBar';
import { MapTracker, type Aircraft } from '../_components/MapTracker';

export const dynamic = 'force-dynamic';

const ACCENT: Record<AirportCode, string> = {
  JFK: 'oklch(0.42 0.20 258)',
  ORD: 'oklch(0.52 0.20 32)',
  ATL: 'oklch(0.50 0.13 175)',
  LAX: 'oklch(0.45 0.16 305)',
};

export const metadata = {
  title: 'Contrail Casino · Tracker',
};

export default async function TrackerPage() {
  const focusAirport: AirportCode = AIRPORT_CODES[0];
  const db = getDb();
  const [user, scores, takeoffPace, takeoff, landing, trafficRows] = await Promise.all([
    getCurrentUser(),
    getCurrentHourScores(),
    getPaceByAirport(30, 'takeoff'),
    getNextTakeoffForAirport(focusAirport),
    getNextLandingForAirport(focusAirport),
    db.select().from(liveAircraft).where(eq(liveAircraft.nearestAirport, focusAirport)),
  ]);
  const featured = takeoff ?? landing ?? null;
  const traffic: Aircraft[] = trafficRows.map((r) => ({
    icao24: r.icao24,
    callsign: r.callsign,
    typecode: r.typecode,
    isHeavy: r.isHeavy,
    latitude: r.latitude,
    longitude: r.longitude,
    altitudeFt: r.altitudeFt,
    velocityKt: r.velocityKt,
    headingDeg: r.headingDeg,
    onGround: r.onGround,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    <div className="app" data-route="tracker">
      <TopBar callsign={user?.callsign ?? '—'} balance={user?.balance ?? 0} active="tracker" />
      <main className="screen screen-tracker-full">
        <div className="screen-inner">
          <div className="screen-head">
            <div>
              <div className="micro mono screen-kicker">LIVE · UPDATES EVERY 15 SECONDS</div>
              <h1 className="screen-title">Live Tracker</h1>
              <p className="screen-sub">
                Aircraft movements across the four tracked airports. Map below shows JFK
                live; rotate via the strip header.
              </p>
            </div>
          </div>

          <div className="tracker-strip">
            {AIRPORT_CODES.map((c) => {
              const t = scores.takeoff[c];
              const ops = scores.total_ops[c];
              const heavy = scores.heavy[c];
              const ldg = Math.max(0, ops - t);
              return (
                <div key={c} className={`ts-cell airport-${c.toLowerCase()}`}>
                  <div className="ts-head">
                    <span className="ts-led" />
                    <span className="ts-code">{c}</span>
                    <span className="ts-name mono">{AIRPORT_NAMES[c].replace(/\s*\(.*\)\s*/, '')}</span>
                  </div>
                  <div className="ts-stats">
                    <div>
                      <span className="k mono">TO</span>
                      <span className="v">{t}</span>
                    </div>
                    <div>
                      <span className="k mono">LDG</span>
                      <span className="v">{ldg}</span>
                    </div>
                    <div>
                      <span className="k mono">HVY</span>
                      <span className="v">{heavy}</span>
                    </div>
                    <div>
                      <span className="k mono">OPS</span>
                      <span className="v">{ops}</span>
                    </div>
                    <div>
                      <span className="k mono">PACE</span>
                      <span className="v">
                        {Math.round(takeoffPace[c])}
                        <span className="u mono">/h</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="tracker-big" style={{ minHeight: 520, padding: 0, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              <MapTracker
                airport={focusAirport}
                accent={ACCENT[focusAirport]}
                aircraft={traffic}
                followIcao24={featured?.icao24 ?? null}
                featured={featured ? { callsign: featured.callsign, typecode: featured.typecode, isHeavy: featured.isHeavy } : null}
                ageSec={null}
              />
            </div>
          </div>
        </div>
      </main>
      <footer style={{ height: 44, borderTop: '0.5px solid var(--line)', background: 'var(--bg-1)' }} />
    </div>
  );
}

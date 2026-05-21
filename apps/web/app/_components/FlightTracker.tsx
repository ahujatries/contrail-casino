'use client';

import { useEffect, useRef, useState } from 'react';
import type { AirportCode } from '@airport-pong/shared';

type Coord = { lat: number; lng: number; name: string };

const FT_AIRPORTS: Record<string, Coord> = {
  JFK: { lat: 40.6, lng: -73.8, name: 'New York' },
  ORD: { lat: 42.0, lng: -87.9, name: 'Chicago' },
  ATL: { lat: 33.6, lng: -84.4, name: 'Atlanta' },
  LAX: { lat: 34.0, lng: -118.4, name: 'Los Angeles' },
  DEN: { lat: 39.9, lng: -104.7, name: 'Denver' },
  DFW: { lat: 32.9, lng: -97.0, name: 'Dallas-Ft Worth' },
  MIA: { lat: 25.8, lng: -80.3, name: 'Miami' },
  SFO: { lat: 37.6, lng: -122.4, name: 'San Francisco' },
  SEA: { lat: 47.4, lng: -122.3, name: 'Seattle' },
  BOS: { lat: 42.4, lng: -71.0, name: 'Boston' },
  PHX: { lat: 33.4, lng: -112.0, name: 'Phoenix' },
  IAH: { lat: 30.0, lng: -95.3, name: 'Houston' },
  LAS: { lat: 36.1, lng: -115.2, name: 'Las Vegas' },
  MSP: { lat: 44.9, lng: -93.2, name: 'Minneapolis' },
  CLT: { lat: 35.2, lng: -80.9, name: 'Charlotte' },
};

const ftProj = (lat: number, lng: number) => ({
  x: ((lng + 130) / 70) * 300,
  y: 160 - ((lat - 22) / 30) * 160,
});

const US_PATH =
  'M 22.7 18.7 L 150 16.5 L 265.7 24 L 240 61.3 L 233.6 90.7 L 212.1 142.9 L 195 130 L 175.7 121.6 L 141.4 138.7 L 100 122 L 55.7 104 L 30 80 L 23.6 61.3 Z';

const POLL_MS = 15_000;
const TRAIL_MAX = 30;

export type LiveFlight = {
  airport: AirportCode;
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  latitude: number | null;
  longitude: number | null;
  altitudeFt: number | null;
  velocityKt: number | null;
  headingDeg: number | null;
  onGround: boolean;
  takeoffAt: string | null;
  updatedAt: string;
};

type Props = {
  airport: AirportCode;
  accent: string;
  initialFlight: LiveFlight | null;
};

type TrailPoint = { lat: number; lng: number };

/**
 * Plots the real position of one currently-airborne flight from this airport.
 * Position comes from `live_aircraft` (updated every 15s by the worker).
 * Trail is built client-side from successive polls.
 * No synthetic route arc and no predicted destination — what you see is what
 * OpenSky is currently reporting.
 */
export function FlightTracker({ airport, accent, initialFlight }: Props) {
  const [flight, setFlight] = useState<LiveFlight | null>(initialFlight);
  const [trail, setTrail] = useState<TrailPoint[]>(() =>
    initialFlight?.latitude != null && initialFlight?.longitude != null
      ? [{ lat: initialFlight.latitude, lng: initialFlight.longitude }]
      : []
  );
  const lastIcaoRef = useRef<string | null>(initialFlight?.icao24 ?? null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/featured-flight?airport=${airport}`, {
          cache: 'no-store',
        });
        if (!r.ok) return;
        const { flight: next } = (await r.json()) as { flight: LiveFlight | null };
        if (cancelled) return;
        if (!next) {
          setFlight(null);
          return;
        }
        setFlight(next);
        // Reset trail if we're now tracking a different aircraft
        if (lastIcaoRef.current && lastIcaoRef.current !== next.icao24) {
          setTrail(
            next.latitude != null && next.longitude != null
              ? [{ lat: next.latitude, lng: next.longitude }]
              : []
          );
        } else if (next.latitude != null && next.longitude != null) {
          setTrail((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.lat === next.latitude && last.lng === next.longitude) return prev;
            const t = [...prev, { lat: next.latitude!, lng: next.longitude! }];
            return t.length > TRAIL_MAX ? t.slice(t.length - TRAIL_MAX) : t;
          });
        }
        lastIcaoRef.current = next.icao24;
      } catch {
        // ignore transient errors
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [airport]);

  const origin = FT_AIRPORTS[airport];
  const o = ftProj(origin.lat, origin.lng);

  // Reuse our origin marker location even when no flight — empty state
  if (!flight || flight.latitude == null || flight.longitude == null) {
    return (
      <div className="ft-wrap">
        <svg
          viewBox="0 0 300 200"
          preserveAspectRatio="xMidYMid meet"
          className="ft-svg"
        >
          <MapBackdrop airport={airport} />
          <OriginMarker x={o.x} y={o.y} code={airport} accent={accent} />
          <text
            x="150"
            y="180"
            fontSize="5"
            fill="oklch(0.55 0.04 230 / 0.8)"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
          >
            NO DEPARTURES AIRBORNE
          </text>
        </svg>
        <div className="ft-tele">
          <div className="ft-cell">
            <span className="k">CS</span>
            <span className="v">—</span>
          </div>
          <div className="ft-cell">
            <span className="k">AC</span>
            <span className="v">—</span>
          </div>
          <div className="ft-cell">
            <span className="k">ALT</span>
            <span className="v">—</span>
          </div>
          <div className="ft-cell">
            <span className="k">GS</span>
            <span className="v">—</span>
          </div>
          <div className="ft-cell">
            <span className="k">HDG</span>
            <span className="v">—</span>
          </div>
        </div>
      </div>
    );
  }

  const plane = ftProj(flight.latitude, flight.longitude);
  const headingRotate = flight.headingDeg ?? 0;
  const trailPts = trail
    .map((p) => ftProj(p.lat, p.lng))
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' L ');
  const trailD = trail.length > 1 ? `M ${trailPts}` : '';

  // Heading vector (small arrow showing direction of travel)
  const headRad = ((flight.headingDeg ?? 0) - 90) * (Math.PI / 180);
  const headX = plane.x + Math.cos(headRad) * 16;
  const headY = plane.y + Math.sin(headRad) * 16;

  // Telemetry from real data
  const altFL = flight.altitudeFt != null ? Math.round(flight.altitudeFt / 100) : null;
  const distFromOrigin = haversineNm(
    origin.lat,
    origin.lng,
    flight.latitude,
    flight.longitude
  );
  const minsAirborne =
    flight.takeoffAt != null
      ? Math.max(0, Math.floor((Date.now() - new Date(flight.takeoffAt).getTime()) / 60_000))
      : null;
  const ageSec = Math.floor((Date.now() - new Date(flight.updatedAt).getTime()) / 1000);
  const stale = ageSec > 45;

  return (
    <div className="ft-wrap">
      <svg
        viewBox="0 0 300 200"
        preserveAspectRatio="xMidYMid meet"
        className="ft-svg"
      >
        <MapBackdrop airport={airport} />
        {trailD && (
          <path d={trailD} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        )}
        <line
          x1={plane.x}
          y1={plane.y}
          x2={headX}
          y2={headY}
          stroke={accent}
          strokeWidth="0.6"
          opacity="0.7"
          strokeDasharray="1 1.5"
        />
        <OriginMarker x={o.x} y={o.y} code={airport} accent={accent} />
        <g transform={`translate(${plane.x} ${plane.y})`}>
          <circle r="6" fill={accent} opacity="0.10" />
          <circle r="3.6" fill={accent} opacity="0.18" />
          <g transform={`rotate(${headingRotate})`}>
            <path
              d="M 0 -3.2 L 2.2 1.6 L 2.2 2.6 L 0 1.6 L -2.2 2.6 L -2.2 1.6 Z"
              fill="oklch(0.98 0.005 250)"
              stroke={accent}
              strokeWidth="0.5"
            />
          </g>
          <text
            x="6"
            y="-2.5"
            fontSize="3.2"
            fill="oklch(0.97 0.005 250)"
            fontFamily="var(--font-mono)"
            fontWeight={600}
          >
            {flight.callsign ?? flight.icao24.toUpperCase()}
          </text>
          {flight.typecode && (
            <text
              x="6"
              y="1.2"
              fontSize="2.8"
              fill="oklch(0.66 0.01 250)"
              fontFamily="var(--font-mono)"
            >
              {flight.typecode}
              {flight.isHeavy ? ' · HVY' : ''}
            </text>
          )}
        </g>
      </svg>

      <div className="ft-tele">
        <div className="ft-cell">
          <span className="k">CS</span>
          <span className="v">{flight.callsign ?? '—'}</span>
        </div>
        <div className="ft-cell">
          <span className="k">AC</span>
          <span className="v">
            {flight.typecode ?? '—'}
            {flight.isHeavy ? ' ·H' : ''}
          </span>
        </div>
        <div className="ft-cell">
          <span className="k">ALT</span>
          <span className="v">
            {altFL != null ? `FL${String(altFL).padStart(3, '0')}` : '—'}
          </span>
        </div>
        <div className="ft-cell">
          <span className="k">GS</span>
          <span className="v">
            {flight.velocityKt != null ? (
              <>
                {flight.velocityKt}
                <span className="u">kt</span>
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
        <div className="ft-cell">
          <span className="k">HDG</span>
          <span className="v">
            {flight.headingDeg != null
              ? String(Math.round(flight.headingDeg)).padStart(3, '0') + '°'
              : '—'}
          </span>
        </div>
        <div className="ft-cell">
          <span className="k">DIST</span>
          <span className="v">
            {Math.round(distFromOrigin)}
            <span className="u">nm</span>
          </span>
        </div>
        <div className="ft-cell">
          <span className="k">AIR</span>
          <span className="v">
            {minsAirborne != null ? (
              <>
                {minsAirborne}
                <span className="u">m</span>
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
        <div className="ft-prog">
          <div
            className="ft-prog-pct"
            style={{
              color: stale ? 'var(--neg)' : accent,
              textAlign: 'left',
              fontSize: 9,
              letterSpacing: '0.15em',
            }}
          >
            {stale ? `STALE ${ageSec}s` : `LIVE · ${ageSec}s`}
          </div>
        </div>
      </div>
    </div>
  );
}

function MapBackdrop({ airport }: { airport: AirportCode }) {
  return (
    <>
      <defs>
        <linearGradient id={`ft-bg-${airport}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.18 0.022 250)" />
          <stop offset="100%" stopColor="oklch(0.12 0.020 250)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="300" height="200" fill={`url(#ft-bg-${airport})`} />
      <g stroke="oklch(0.42 0.04 230 / 0.16)" strokeWidth="0.3" strokeDasharray="1 3">
        {[-120, -110, -100, -90, -80, -70].map((lng) => {
          const x = ftProj(0, lng).x;
          return <line key={'v' + lng} x1={x} y1="0" x2={x} y2="160" />;
        })}
        {[30, 35, 40, 45].map((lat) => {
          const y = ftProj(lat, 0).y;
          return <line key={'h' + lat} x1="0" y1={y} x2="300" y2={y} />;
        })}
      </g>
      {[-120, -100, -80].map((lng) => {
        const x = ftProj(0, lng).x;
        return (
          <text
            key={'lt' + lng}
            x={x + 1}
            y="158"
            fontSize="3.6"
            fill="oklch(0.46 0.04 230 / 0.55)"
            fontFamily="var(--font-mono)"
          >
            {Math.abs(lng)}°W
          </text>
        );
      })}
      <path
        d={US_PATH}
        fill="oklch(0.20 0.025 250 / 0.55)"
        stroke="oklch(0.50 0.045 235 / 0.65)"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {Object.entries(FT_AIRPORTS).map(([code, a]) => {
        const p = ftProj(a.lat, a.lng);
        return (
          <g key={code}>
            <circle cx={p.x} cy={p.y} r="0.8" fill="oklch(0.50 0.04 230 / 0.6)" />
            <text
              x={p.x + 2.2}
              y={p.y + 1.3}
              fontSize="3"
              fill="oklch(0.50 0.04 230 / 0.7)"
              fontFamily="var(--font-mono)"
            >
              {code}
            </text>
          </g>
        );
      })}
    </>
  );
}

function OriginMarker({
  x,
  y,
  code,
  accent,
}: {
  x: number;
  y: number;
  code: string;
  accent: string;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r="3" fill="none" stroke={accent} strokeWidth="0.7" />
      <circle cx={x} cy={y} r="1.1" fill={accent} />
      <text
        x={x}
        y={y - 4.5}
        fontSize="4.4"
        fontWeight={700}
        fill="oklch(0.97 0.005 250)"
        textAnchor="middle"
      >
        {code}
      </text>
    </g>
  );
}

const haversineNm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 3440.065; // nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

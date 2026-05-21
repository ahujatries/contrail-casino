'use client';

import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AIRPORT_CENTERS, type AirportCode } from '@airport-pong/shared';
import type { LiveFlight } from './FlightTracker';

type Aircraft = {
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
  updatedAt: string;
};

type Props = {
  airport: AirportCode;
  accent: string;
  featured: LiveFlight | null;
};

const POLL_MS = 15_000;
const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Real Mapbox dark map showing every aircraft `live_aircraft` has tagged
 * to this airport (within ~60nm). The featured flight (most recent
 * takeoff still airborne) is highlighted in the airport's accent color
 * and used to drive the telemetry strip below.
 */
export function MapTracker({ airport, accent, featured }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Use unknowns to avoid bundling mapbox-gl types into the SSR boundary
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [featuredLive, setFeaturedLive] = useState<LiveFlight | null>(featured);
  const [ready, setReady] = useState(false);
  const featuredIcaoRef = useRef<string | null>(featured?.icao24 ?? null);
  featuredIcaoRef.current = featuredLive?.icao24 ?? featured?.icao24 ?? null;

  // Init Mapbox
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const mapbox = (await import('mapbox-gl')).default;
      if (cancelled || !containerRef.current) return;
      mapbox.accessToken = TOKEN;
      const center = AIRPORT_CENTERS[airport];
      const map = new mapbox.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [center.lng, center.lat],
        zoom: 7.2,
        attributionControl: false,
        cooperativeGestures: false,
        pitchWithRotate: false,
        dragRotate: false,
      });
      map.on('load', () => {
        if (cancelled) return;
        // Tweak built-in styling to fit our palette
        try {
          map.setPaintProperty('water', 'fill-color', '#0a0e15');
          map.setPaintProperty('land', 'background-color', '#0d1320');
        } catch {}
        setReady(true);
      });
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      try {
        m?.remove?.();
      } catch {}
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [airport]);

  // Poll airport traffic
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [trafficR, featR] = await Promise.all([
          fetch(`/api/airport-traffic?airport=${airport}`, { cache: 'no-store' }),
          fetch(`/api/featured-flight?airport=${airport}`, { cache: 'no-store' }),
        ]);
        if (!trafficR.ok) return;
        const { aircraft: ac } = (await trafficR.json()) as { aircraft: Aircraft[] };
        if (cancelled) return;
        setAircraft(ac);
        if (featR.ok) {
          const { flight } = (await featR.json()) as { flight: LiveFlight | null };
          if (!cancelled) setFeaturedLive(flight);
        }
      } catch {
        /* ignore */
      }
    };
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [airport]);

  // Sync markers to current aircraft set
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current as {
      getContainer: () => HTMLDivElement;
    };
    void map; // satisfy noUnusedLocals

    (async () => {
      const mapbox = (await import('mapbox-gl')).default;
      const m = mapRef.current as InstanceType<typeof mapbox.Map> | null;
      if (!m) return;

      const seen = new Set<string>();
      for (const a of aircraft) {
        if (a.latitude == null || a.longitude == null) continue;
        seen.add(a.icao24);
        const existing = markersRef.current.get(a.icao24) as
          | InstanceType<typeof mapbox.Marker>
          | undefined;
        const isFeatured = a.icao24 === featuredIcaoRef.current;
        const el = existing ? (existing.getElement() as HTMLDivElement) : buildMarkerEl();
        styleMarker(el, a, isFeatured, accent);
        if (existing) {
          existing.setLngLat([a.longitude, a.latitude]);
        } else {
          const marker = new mapbox.Marker({ element: el, anchor: 'center', rotationAlignment: 'map' })
            .setLngLat([a.longitude, a.latitude])
            .addTo(m);
          markersRef.current.set(a.icao24, marker);
        }
      }
      // Remove markers that aren't in this snapshot
      for (const [icao, marker] of markersRef.current) {
        if (!seen.has(icao)) {
          (marker as InstanceType<typeof mapbox.Marker>).remove();
          markersRef.current.delete(icao);
        }
      }
    })();
  }, [aircraft, ready, accent]);

  if (!TOKEN) {
    return (
      <div className="ft-wrap" style={{ alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
        Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the live map.
      </div>
    );
  }

  const f = featuredLive ?? featured;
  const altFL = f?.altitudeFt != null ? Math.round(f.altitudeFt / 100) : null;
  const ageSec = f ? Math.max(0, Math.floor((Date.now() - new Date(f.updatedAt).getTime()) / 1000)) : null;
  const stale = ageSec != null && ageSec > 45;

  return (
    <div className="ft-wrap">
      <div ref={containerRef} className="map-canvas" />
      <div className="ft-tele">
        <div className="ft-cell">
          <span className="k">CS</span>
          <span className="v">{f?.callsign ?? '—'}</span>
        </div>
        <div className="ft-cell">
          <span className="k">AC</span>
          <span className="v">
            {f?.typecode ?? '—'}
            {f?.isHeavy ? ' ·H' : ''}
          </span>
        </div>
        <div className="ft-cell">
          <span className="k">ALT</span>
          <span className="v">{altFL != null ? `FL${String(altFL).padStart(3, '0')}` : '—'}</span>
        </div>
        <div className="ft-cell">
          <span className="k">GS</span>
          <span className="v">
            {f?.velocityKt != null ? (
              <>
                {f.velocityKt}
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
            {f?.headingDeg != null ? String(Math.round(f.headingDeg)).padStart(3, '0') + '°' : '—'}
          </span>
        </div>
        <div className="ft-cell">
          <span className="k">TRAFFIC</span>
          <span className="v">{aircraft.length}</span>
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
            {ageSec != null ? (stale ? `STALE ${ageSec}s` : `LIVE · ${ageSec}s`) : 'NO FEED'}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildMarkerEl(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'ac-marker';
  el.innerHTML = `<svg viewBox="0 0 14 14" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
    <path d="M 7 1 L 9.6 9 L 9.6 11 L 7 9.6 L 4.4 11 L 4.4 9 Z" />
  </svg>`;
  return el;
}

function styleMarker(
  el: HTMLDivElement,
  a: Aircraft,
  isFeatured: boolean,
  accent: string
) {
  const heading = a.headingDeg ?? 0;
  const baseSize = isFeatured ? 18 : a.isHeavy ? 13 : 11;
  const color = isFeatured
    ? accent
    : a.onGround
      ? 'oklch(0.55 0.02 250)'
      : a.isHeavy
        ? 'oklch(0.85 0.08 80)'
        : 'oklch(0.92 0.005 250)';
  el.style.width = `${baseSize}px`;
  el.style.height = `${baseSize}px`;
  el.style.transform = `rotate(${heading}deg)`;
  el.style.transformOrigin = 'center';
  el.style.transition = 'transform 0.6s linear';
  el.style.cursor = 'pointer';
  el.style.pointerEvents = 'auto';
  el.style.filter = isFeatured
    ? `drop-shadow(0 0 6px ${accent})`
    : a.isHeavy
      ? 'drop-shadow(0 0 3px oklch(0.85 0.08 80 / 0.6))'
      : 'none';
  const svg = el.querySelector('svg');
  if (svg) {
    svg.setAttribute('width', String(baseSize));
    svg.setAttribute('height', String(baseSize));
    const path = svg.querySelector('path');
    if (path) {
      path.setAttribute('fill', color);
      path.setAttribute('stroke', isFeatured ? 'oklch(0.98 0.005 250)' : 'transparent');
      path.setAttribute('stroke-width', isFeatured ? '0.8' : '0');
    }
  }
  el.title = `${a.callsign ?? a.icao24}${a.typecode ? ' · ' + a.typecode : ''}${a.altitudeFt != null ? ' · ' + a.altitudeFt + 'ft' : ''}`;
}

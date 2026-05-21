'use client';

import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AIRPORT_CENTERS, type AirportCode } from '@airport-pong/shared';

export type Aircraft = {
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
  /** All aircraft to render as markers (already pre-fetched by the dashboard). */
  aircraft: Aircraft[];
  /** If set, the map will pan to follow this plane. */
  followIcao24: string | null;
  /** Optional label/details shown in the bottom telemetry strip. */
  featured: { callsign: string | null; typecode: string | null; isHeavy: boolean } | null;
  /** Age of the underlying data in seconds (for the LIVE/STALE indicator). */
  ageSec: number | null;
  /** Map zoom level. ~13 = ground ops, ~9 = approach corridor, ~8 = wide. Default 9. */
  zoom?: number;
};

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

let _mapboxPromise: Promise<typeof import('mapbox-gl')> | null = null;
const loadMapbox = () => {
  if (!_mapboxPromise) _mapboxPromise = import('mapbox-gl');
  return _mapboxPromise;
};

export function MapTracker({
  airport,
  accent,
  aircraft,
  followIcao24,
  featured,
  ageSec,
  zoom = 9,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const markersRef = useRef<Map<string, unknown>>(new Map());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Init Mapbox ──────────────────────────────────────────
  useEffect(() => {
    if (!TOKEN) {
      setError('NEXT_PUBLIC_MAPBOX_TOKEN is missing');
      return;
    }
    if (!containerRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    (async () => {
      let mapbox;
      try {
        mapbox = (await loadMapbox()).default;
      } catch (e) {
        if (!cancelled) setError(`mapbox-gl import failed: ${(e as Error).message}`);
        return;
      }
      if (cancelled || !containerRef.current) return;

      mapbox.accessToken = TOKEN;
      const center = AIRPORT_CENTERS[airport];
      let map;
      try {
        map = new mapbox.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [center.lng, center.lat],
          zoom,
          attributionControl: false,
          cooperativeGestures: false,
          pitchWithRotate: false,
          dragRotate: false,
        });
      } catch (e) {
        if (!cancelled) setError(`mapbox init: ${(e as Error).message}`);
        return;
      }
      mapRef.current = map;

      map.on('error', (e: { error?: { message?: string } }) => {
        if (e?.error?.message && !cancelled) {
          // eslint-disable-next-line no-console
          console.warn(`[mapbox:${airport}]`, e.error.message);
        }
      });
      map.on('load', () => {
        if (cancelled) return;
        try {
          map.setPaintProperty('water', 'fill-color', '#0a0e15');
          map.setPaintProperty('background', 'background-color', '#0d1320');
        } catch {}
        requestAnimationFrame(() => map.resize());
        setTimeout(() => map.resize(), 200);
        setReady(true);
      });

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          try {
            map.resize();
          } catch {}
        });
        resizeObserver.observe(containerRef.current);
      }
    })();

    return () => {
      cancelled = true;
      try {
        resizeObserver?.disconnect();
      } catch {}
      const m = mapRef.current as { remove?: () => void } | null;
      try {
        m?.remove?.();
      } catch {}
      mapRef.current = null;
      markersRef.current.clear();
    };
  }, [airport]);

  // ── Sync markers (skip work if nothing meaningful changed) ─
  const aircraftSignature = aircraft
    .map((a) => `${a.icao24}|${a.latitude?.toFixed(3)}|${a.longitude?.toFixed(3)}|${a.headingDeg ?? 0}|${a.onGround ? 1 : 0}`)
    .join(',');
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    (async () => {
      const mapbox = (await loadMapbox()).default;
      const m = mapRef.current as InstanceType<typeof mapbox.Map> | null;
      if (!m) return;

      const seen = new Set<string>();
      for (const a of aircraft) {
        if (a.latitude == null || a.longitude == null) continue;
        seen.add(a.icao24);
        const existing = markersRef.current.get(a.icao24) as
          | InstanceType<typeof mapbox.Marker>
          | undefined;
        const isFeatured = a.icao24 === followIcao24;
        const el = existing ? (existing.getElement() as HTMLDivElement) : buildMarkerEl();
        styleMarker(el, a, isFeatured, accent);
        if (existing) {
          existing.setLngLat([a.longitude, a.latitude]);
        } else {
          const marker = new mapbox.Marker({
            element: el,
            anchor: 'center',
            rotationAlignment: 'map',
          })
            .setLngLat([a.longitude, a.latitude])
            .addTo(m);
          markersRef.current.set(a.icao24, marker);
        }
      }
      for (const [icao, marker] of markersRef.current) {
        if (!seen.has(icao)) {
          (marker as InstanceType<typeof mapbox.Marker>).remove();
          markersRef.current.delete(icao);
        }
      }
    })();
  }, [aircraftSignature, ready, accent, followIcao24, aircraft]);

  // ── Pan map to follow the focused plane ───────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !followIcao24) return;
    const plane = aircraft.find((a) => a.icao24 === followIcao24);
    if (!plane || plane.latitude == null || plane.longitude == null) return;
    (async () => {
      const mapbox = (await loadMapbox()).default;
      const m = mapRef.current as InstanceType<typeof mapbox.Map> | null;
      if (!m) return;
      m.easeTo({ center: [plane.longitude!, plane.latitude!], zoom, duration: 800 });
    })();
  }, [followIcao24, aircraftSignature, ready, aircraft, zoom]);

  // ── Zoom changes (mode switch) — animate to new zoom even without follow ──
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const center = AIRPORT_CENTERS[airport];
    (async () => {
      const mapbox = (await loadMapbox()).default;
      const m = mapRef.current as InstanceType<typeof mapbox.Map> | null;
      if (!m) return;
      // Only re-center to airport if we're not following a plane
      if (followIcao24) {
        m.easeTo({ zoom, duration: 700 });
      } else {
        m.easeTo({ center: [center.lng, center.lat], zoom, duration: 700 });
      }
    })();
  }, [zoom, airport, ready, followIcao24]);

  // ── Stale / error UI ──────────────────────────────────────
  const stale = ageSec != null && ageSec > 60;
  const noToken = !TOKEN;

  return (
    <div className="ft-wrap">
      <div ref={containerRef} className="map-canvas">
        {error && (
          <div className="map-error mono">
            <strong>MAPBOX</strong>
            <span>{error}</span>
          </div>
        )}
        {noToken && (
          <div className="map-error mono">
            <strong>NEXT_PUBLIC_MAPBOX_TOKEN missing</strong>
            <span>Set it in .env.local and restart dev.</span>
          </div>
        )}
      </div>
      <div className="ft-tele">
        <div className="ft-cell">
          <span className="k">CS</span>
          <span className="v">{featured?.callsign ?? '—'}</span>
        </div>
        <div className="ft-cell">
          <span className="k">AC</span>
          <span className="v">
            {featured?.typecode ?? '—'}
            {featured?.isHeavy ? ' ·H' : ''}
          </span>
        </div>
        <div className="ft-cell">
          <span className="k">TRAFFIC</span>
          <span className="v">{aircraft.filter((a) => a.latitude != null).length}</span>
        </div>
        <div className="ft-prog">
          <div
            className="ft-prog-pct"
            style={{
              color: stale ? 'var(--neg)' : accent,
              textAlign: 'left',
              fontSize: 9.5,
              letterSpacing: '0.14em',
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
  const baseSize = isFeatured ? 22 : a.isHeavy ? 13 : 11;
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
    ? `drop-shadow(0 0 8px ${accent})`
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

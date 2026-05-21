'use client';

import { useMemo } from 'react';
import {
  AIRPORT_CENTERS,
  AIRPORT_COLORS,
  AIRPORT_NAMES,
  AIRPORT_RUNWAY_HEADINGS,
  TRACKER_RADIUS_DEG,
  type AirportCode,
} from '@airport-pong/shared';

export type ScopeAircraft = {
  icao24: string;
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  latitude: number;
  longitude: number;
  altitudeFt: number | null;
  velocityKt: number | null;
  headingDeg: number | null;
  onGround: boolean;
};

type Props = {
  airport: AirportCode;
  aircraft: ScopeAircraft[];
  label?: string;
};

const VIEW = 1000;
const CENTER = VIEW / 2;
const OUTER_R = 460;

/**
 * SVG radar scope for one airport. Pure presentation — abstract, no map tiles.
 *
 * Projection: equirectangular-ish around the airport center, with longitude
 * scaled by cos(latitude) so headings look right at our mid-latitudes.
 * Aircraft outside `TRACKER_RADIUS_DEG` are clipped to the rim.
 */
export function RadarScope({ airport, aircraft, label }: Props) {
  const center = AIRPORT_CENTERS[airport];
  const lngScale = Math.cos((center.lat * Math.PI) / 180);
  const accent = AIRPORT_COLORS[airport];

  const points = useMemo(() => {
    return aircraft
      .filter((a) => a.latitude != null && a.longitude != null)
      .map((a) => {
        const dLat = a.latitude - center.lat;
        const dLng = (a.longitude - center.lng) * lngScale;
        // unit position in [-1, 1] across the scope radius
        const ux = dLng / TRACKER_RADIUS_DEG;
        const uy = -dLat / TRACKER_RADIUS_DEG;
        const r = Math.sqrt(ux * ux + uy * uy);
        // clip to inside the scope rim
        const clamp = r > 1 ? 1 / r : 1;
        const x = CENTER + ux * clamp * OUTER_R;
        const y = CENTER + uy * clamp * OUTER_R;
        return { a, x, y };
      });
  }, [aircraft, center.lat, center.lng, lngScale]);

  return (
    <div className="relative aspect-square w-full overflow-hidden bg-black select-none">
      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full h-full"
      >
        <defs>
          <radialGradient id={`bg-${airport}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a0e00" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Subtle warm glow at center */}
        <rect width={VIEW} height={VIEW} fill={`url(#bg-${airport})`} />

        {/* Distance rings */}
        {[0.25, 0.5, 0.75, 1].map((frac) => (
          <circle
            key={frac}
            cx={CENTER}
            cy={CENTER}
            r={OUTER_R * frac}
            fill="none"
            stroke="#FFB000"
            strokeOpacity={frac === 1 ? 0.4 : 0.12}
            strokeWidth={frac === 1 ? 1.5 : 1}
            strokeDasharray={frac === 1 ? '0' : '4 6'}
          />
        ))}

        {/* Cardinal bearing markers */}
        {[0, 90, 180, 270].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x = CENTER + Math.sin(rad) * OUTER_R;
          const y = CENTER - Math.cos(rad) * OUTER_R;
          const labelX = CENTER + Math.sin(rad) * (OUTER_R + 22);
          const labelY = CENTER - Math.cos(rad) * (OUTER_R + 22);
          const lbl = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : 'W';
          return (
            <g key={deg}>
              <line
                x1={x}
                y1={y}
                x2={CENTER + Math.sin(rad) * (OUTER_R - 14)}
                y2={CENTER - Math.cos(rad) * (OUTER_R - 14)}
                stroke="#FFB000"
                strokeOpacity={0.4}
                strokeWidth={1.5}
              />
              <text
                x={labelX}
                y={labelY}
                fill="#FFB000"
                fillOpacity={0.4}
                fontFamily="ui-monospace, monospace"
                fontSize={20}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {lbl}
              </text>
            </g>
          );
        })}

        {/* Runway hints — stylized strokes at predominant headings */}
        {AIRPORT_RUNWAY_HEADINGS[airport].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const dx = Math.sin(rad) * 42;
          const dy = -Math.cos(rad) * 42;
          return (
            <line
              key={i}
              x1={CENTER - dx}
              y1={CENTER - dy}
              x2={CENTER + dx}
              y2={CENTER + dy}
              stroke={accent}
              strokeOpacity={0.85}
              strokeWidth={6}
              strokeLinecap="round"
            />
          );
        })}

        {/* Airport ICAO */}
        <text
          x={CENTER}
          y={CENTER + 90}
          fill={accent}
          fontFamily="ui-monospace, monospace"
          fontWeight={600}
          fontSize={42}
          letterSpacing={6}
          textAnchor="middle"
        >
          {airport}
        </text>

        {/* Aircraft */}
        {points.map(({ a, x, y }) => {
          const isAirborne = !a.onGround;
          const fill = isAirborne ? '#FFB000' : '#8A5F00';
          const r = a.isHeavy ? 7 : 5;
          const headRad =
            a.headingDeg != null ? (a.headingDeg * Math.PI) / 180 : null;
          const headLen = isAirborne ? 14 : 6;
          const headX = headRad != null ? x + Math.sin(headRad) * headLen : null;
          const headY = headRad != null ? y - Math.cos(headRad) * headLen : null;
          return (
            <g key={a.icao24} opacity={isAirborne ? 1 : 0.55}>
              {headX != null && headY != null && (
                <line
                  x1={x}
                  y1={y}
                  x2={headX}
                  y2={headY}
                  stroke={fill}
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                />
              )}
              <circle cx={x} cy={y} r={r} fill={fill} />
              {a.isHeavy && (
                <circle
                  cx={x}
                  cy={y}
                  r={r + 4}
                  fill="none"
                  stroke="#FFB000"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* Overlay chrome */}
      <div className="absolute top-3 left-3 right-3 flex items-baseline justify-between text-[10px] tracking-[0.3em] text-amber-500/60 font-mono">
        <span>{label ?? AIRPORT_NAMES[airport]}</span>
        <span className="text-amber-400">{points.length} CONTACTS</span>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-baseline justify-between text-[9px] tracking-[0.25em] text-amber-500/40 font-mono">
        <span>60nm scope</span>
        <span>{points.filter((p) => p.a.isHeavy).length} HEAVY</span>
      </div>
    </div>
  );
}

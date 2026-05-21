'use client';

import type { AirportCode } from '@airport-pong/shared';
import { AIRPORT_NAMES } from '@airport-pong/shared';
import { LIVE_CAMS } from '../../lib/live-cams';

type Props = {
  airport: AirportCode;
  accent: string;
};

/**
 * Per-airport live cam pane. Renders an embedded YouTube live stream when
 * one is configured in lib/live-cams.ts; otherwise shows a search link the
 * user can click to find a live spotter stream on YouTube. Always muted so
 * it doesn't fight the ATC audio.
 */
export function LiveCam({ airport, accent }: Props) {
  const cam = LIVE_CAMS[airport];
  const airportName = AIRPORT_NAMES[airport].replace(/\s*\(.*\)\s*/, '');

  if (cam.embedUrl) {
    return (
      <div className="livecam-wrap">
        <iframe
          key={cam.embedUrl}
          className="livecam-iframe"
          src={cam.embedUrl}
          title={`${airport} live cam`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
        <div className="livecam-meta mono">
          <span style={{ color: accent }}>{airport}</span>
          <span>·</span>
          <span>LIVE CAM</span>
          <span>·</span>
          <span className="livecam-src">{cam.source}</span>
          <a
            className="livecam-open-mini"
            href={cam.searchUrl}
            target="_blank"
            rel="noreferrer"
            title="Browse other live streams"
          >
            MORE ↗
          </a>
        </div>
      </div>
    );
  }

  // No embed configured — show a tasteful placeholder + outbound link.
  return (
    <div className="livecam-empty">
      <div className="livecam-empty-ap mono" style={{ color: accent }}>
        {airport}
      </div>
      <div className="livecam-empty-title mono">{airportName.toUpperCase()}</div>
      <div className="livecam-empty-msg">
        Live spotter streams for {airport} aren&rsquo;t embedded by default — they
        rotate too often to hardcode. Open YouTube to pick a current stream.
      </div>
      <a
        className="livecam-open"
        href={cam.searchUrl}
        target="_blank"
        rel="noreferrer"
        style={{ borderColor: accent, color: accent }}
      >
        OPEN LIVE SPOTTERS ON {cam.source.toUpperCase()} ↗
      </a>
      <div className="livecam-hint mono">
        To embed a permanent stream, set <code>embedUrl</code> for {airport} in
        <code>apps/web/lib/live-cams.ts</code>.
      </div>
    </div>
  );
}

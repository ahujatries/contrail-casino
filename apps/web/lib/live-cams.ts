import type { AirportCode } from '@airport-pong/shared';

/**
 * Per-airport live cam config. The honest reality: there's no public API
 * for "current live airport cam"; the actual streams come from spotter
 * channels on YouTube whose video IDs rotate. So the data shape here is:
 *
 *   - `embedUrl` — if you have a specific YouTube video or channel-live
 *     embed URL, set it and we'll iframe it directly (autoplay muted so
 *     it doesn't clash with the ATC audio).
 *   - `searchUrl` — always populated; falls back to YouTube's Live-filtered
 *     search results so the user can pick a live stream themselves.
 *
 * To wire a specific embed once you find a stable stream:
 *
 *   embedUrl: `https://www.youtube.com/embed/<VIDEO_ID>?autoplay=1&mute=1`
 *   OR
 *   embedUrl: `https://www.youtube.com/embed/live_stream?channel=<CHANNEL_ID>&autoplay=1&mute=1`
 *
 * The channel-live variant auto-loads whatever stream that channel is
 * currently broadcasting — useful for spotter channels that run 24/7.
 */
export type LiveCam = {
  /** Optional iframe-embeddable URL. If omitted, only the search link is shown. */
  embedUrl?: string;
  /** Always populated: open this URL in a new tab to browse live streams. */
  searchUrl: string;
  /** Short source label shown to the user. */
  source: string;
};

const ytLiveSearch = (q: string) =>
  // sp=EgJAAQ%253D%253D restricts the search to currently-live broadcasts.
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgJAAQ%253D%253D`;

export const LIVE_CAMS: Record<AirportCode, LiveCam> = {
  JFK: {
    searchUrl: ytLiveSearch('JFK airport live spotting'),
    source: 'YouTube',
  },
  ORD: {
    searchUrl: ytLiveSearch('ORD O\'Hare airport live spotting'),
    source: 'YouTube',
  },
  ATL: {
    searchUrl: ytLiveSearch('ATL Atlanta airport live spotting'),
    source: 'YouTube',
  },
  LAX: {
    searchUrl: ytLiveSearch('LAX airport live spotting'),
    source: 'YouTube',
  },
};

import type { AirportCode } from '@airport-pong/shared';

/**
 * LiveATC.net stream slugs per airport. We hit `https://d.liveatc.net/<slug>`
 * — that's their load balancer, which 302-redirects to the correct edge
 * server (s1-bos, s1-fmt2, etc.) per slug. Saves us from hardcoding a
 * per-airport server map that goes stale.
 *
 * Empirical truth (probed 2026-05-21):
 *   - twr + gnd for JFK / ATL / LAX → 200, audio/mpeg
 *   - all 'app' (TRACON/approach) slugs we tried → 404
 *   - all KORD slugs we tried → 404
 *
 * So this map only includes the freqs that actually serve audio. The
 * AtcPlayer's freq selector filters to `feed[freq] != null`, so empty
 * entries just hide buttons. KORD shows an "ATC not available" state.
 *
 * To add a freq: find the real slug from LiveATC's site (the Cloudflare
 * challenge blocks scraping, so look it up manually), then add it here.
 * Listen via the right .pls file to confirm before committing.
 */
export type AtcFreq = 'twr' | 'gnd' | 'app';

export const ATC_FREQ_LABEL: Record<AtcFreq, string> = {
  twr: 'Tower',
  gnd: 'Ground',
  app: 'Approach',
};

export const ATC_FEEDS: Record<AirportCode, Partial<Record<AtcFreq, string>>> = {
  JFK: { twr: 'kjfk_twr', gnd: 'kjfk_gnd' },
  ATL: { twr: 'katl_twr', gnd: 'katl_gnd' },
  LAX: { twr: 'klax_twr', gnd: 'klax_gnd' },
  // KORD: no LiveATC slugs currently working at the standard names.
  // Tower/Ground/Approach all 404 on both s1-bos and s1-fmt2 as of
  // 2026-05-21. Find the real slug via liveatc.net/search/?icao=kord
  // and add it here.
  ORD: {},
};

export const atcStreamUrl = (slug: string) =>
  `https://d.liveatc.net/${slug}`;

/**
 * Suggest the most useful freq based on the bet mode. Defaults to 'twr'
 * since TRACON ('app') slugs are inconsistent on LiveATC and most often
 * unavailable; tower is the universal fallback that always has coverage.
 */
export const suggestedFreq = (mode: 'takeoff' | 'landing' | 'hour'): AtcFreq => {
  if (mode === 'takeoff') return 'gnd';
  return 'twr';
};

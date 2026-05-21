import type { AirportCode } from '@airport-pong/shared';

/**
 * LiveATC.net stream slugs per airport. Direct AAC stream URL is
 * https://d.liveatc.net/<slug>. These feeds are run by volunteers so they
 * occasionally go offline; the UI shows an error gracefully if a stream 404s.
 *
 * Listen on web: https://www.liveatc.net/search/?icao=<ICAO>
 */
export type AtcFreq = 'twr' | 'gnd' | 'app';

export const ATC_FREQ_LABEL: Record<AtcFreq, string> = {
  twr: 'Tower',
  gnd: 'Ground',
  app: 'Approach',
};

export const ATC_FEEDS: Record<AirportCode, Partial<Record<AtcFreq, string>>> = {
  // Standard LiveATC.net slugs. If a stream is dead, swap the slug here.
  JFK: { twr: 'kjfk_twr', gnd: 'kjfk_gnd', app: 'kjfk_app' },
  ORD: { twr: 'kord_twr', gnd: 'kord_gnd', app: 'kord_app' },
  ATL: { twr: 'katl_twr', gnd: 'katl_gnd', app: 'katl_app' },
  LAX: { twr: 'klax_twr', gnd: 'klax_gnd', app: 'klax_app' },
};

export const atcStreamUrl = (slug: string) =>
  `https://s1-bos.liveatc.net/${slug}`;

/** Suggest the most useful freq based on the bet mode. */
export const suggestedFreq = (mode: 'takeoff' | 'landing' | 'hour'): AtcFreq => {
  if (mode === 'takeoff') return 'gnd';
  if (mode === 'landing') return 'app';
  return 'twr';
};

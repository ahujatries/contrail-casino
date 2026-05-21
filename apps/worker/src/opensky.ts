import { GLOBAL_BBOX, type Bbox } from '@airport-pong/shared';
import { log } from './logger.ts';

/**
 * OpenSky state vector — array indexes per the OpenSky REST docs:
 * https://openskynetwork.github.io/opensky-api/rest.html#response
 */
export type OpenSkyStateRaw = [
  string, // 0 icao24
  string | null, // 1 callsign (may be padded)
  string, // 2 origin_country
  number | null, // 3 time_position (s)
  number, // 4 last_contact (s)
  number | null, // 5 longitude
  number | null, // 6 latitude
  number | null, // 7 baro_altitude (m)
  boolean, // 8 on_ground
  number | null, // 9 velocity (m/s)
  number | null, // 10 true_track (deg)
  number | null, // 11 vertical_rate (m/s)
  number[] | null, // 12 sensors
  number | null, // 13 geo_altitude (m)
  string | null, // 14 squawk
  boolean, // 15 spi
  number, // 16 position_source
  number? // 17 category (optional)
];

export type OpenSkyState = {
  icao24: string;
  callsign: string | null;
  longitude: number | null;
  latitude: number | null;
  baroAltitudeM: number | null;
  onGround: boolean;
  velocityMs: number | null;
  trueTrackDeg: number | null;
  verticalRateMs: number | null;
  geoAltitudeM: number | null;
  lastContact: number; // unix seconds
};

export type OpenSkyResponse = {
  time: number;
  states: OpenSkyState[];
};

const M_PER_FT = 0.3048;
export const metersToFt = (m: number | null | undefined): number | null =>
  m == null ? null : Math.round(m / M_PER_FT);

const parseState = (raw: OpenSkyStateRaw): OpenSkyState => ({
  icao24: raw[0],
  callsign: raw[1]?.trim() || null,
  longitude: raw[5],
  latitude: raw[6],
  baroAltitudeM: raw[7],
  onGround: raw[8],
  velocityMs: raw[9],
  trueTrackDeg: raw[10],
  verticalRateMs: raw[11],
  geoAltitudeM: raw[13],
  lastContact: raw[4],
});

/* ───────────────────────── auth + client pool ──────────────────────── */

type OAuthClient = {
  name: string;
  clientId: string;
  clientSecret: string;
  tokenCache: { token: string; expiresAt: number } | null;
  rateLimitedUntil: number; // epoch ms; 0 if available
};

type BasicAuth = { kind: 'basic'; username: string; password: string };
type AnonAuth = { kind: 'anonymous' };

let _clients: OAuthClient[] | null = null;
let _basic: BasicAuth | null = null;
let _resolvedAuthKind: 'oauth2-pool' | 'basic' | 'anonymous' = 'anonymous';

const buildPool = (): void => {
  const u = process.env.OPENSKY_USERNAME;
  const p = process.env.OPENSKY_PASSWORD;
  if (u && p) {
    _basic = { kind: 'basic', username: u, password: p };
    _resolvedAuthKind = 'basic';
    return;
  }

  const pool: OAuthClient[] = [];
  const add = (idVar: string, secretVar: string, name: string) => {
    const id = process.env[idVar];
    const secret = process.env[secretVar];
    if (id && secret) {
      pool.push({
        name,
        clientId: id,
        clientSecret: secret,
        tokenCache: null,
        rateLimitedUntil: 0,
      });
    }
  };
  add('OPENSKY_CLIENT_ID', 'OPENSKY_CLIENT_SECRET', 'primary');
  add('OPENSKY_CLIENT_ID_2', 'OPENSKY_CLIENT_SECRET_2', 'secondary');
  add('OPENSKY_CLIENT_ID_3', 'OPENSKY_CLIENT_SECRET_3', 'tertiary');

  if (pool.length > 0) {
    _clients = pool;
    _resolvedAuthKind = 'oauth2-pool';
    return;
  }

  _resolvedAuthKind = 'anonymous';
};

buildPool();

export const describeAuth = (): string => {
  if (_resolvedAuthKind === 'oauth2-pool') {
    return `oauth2-pool(${_clients?.length ?? 0})`;
  }
  return _resolvedAuthKind;
};

/** For health endpoint: per-client status. */
export const clientPoolStatus = () => {
  if (!_clients) return [];
  const now = Date.now();
  return _clients.map((c) => ({
    name: c.name,
    rateLimited: c.rateLimitedUntil > now,
    rateLimitedUntilIso: c.rateLimitedUntil > now ? new Date(c.rateLimitedUntil).toISOString() : null,
    tokenExpiresInSec: c.tokenCache ? Math.max(0, Math.floor((c.tokenCache.expiresAt - now) / 1000)) : null,
  }));
};

const pickAvailableClient = (): OAuthClient | null => {
  if (!_clients || _clients.length === 0) return null;
  const now = Date.now();
  const available = _clients.filter((c) => c.rateLimitedUntil <= now);
  if (available.length > 0) {
    // Prefer the client with a fresh-enough cached token; else first one.
    const withToken = available.find((c) => c.tokenCache && c.tokenCache.expiresAt > now + 30_000);
    return withToken ?? available[0];
  }
  // All rate-limited — return the one with the earliest reset
  return _clients.reduce((earliest, c) =>
    c.rateLimitedUntil < earliest.rateLimitedUntil ? c : earliest
  );
};

const markRateLimited = (client: OAuthClient, durationMs: number = 60 * 60 * 1000) => {
  client.rateLimitedUntil = Date.now() + durationMs;
  log.warn('[opensky] client rate-limited', {
    client: client.name,
    untilIso: new Date(client.rateLimitedUntil).toISOString(),
    durationMin: Math.round(durationMs / 60_000),
  });
};

const fetchOauthToken = async (client: OAuthClient): Promise<string> => {
  if (client.tokenCache && Date.now() < client.tokenCache.expiresAt - 30_000) {
    return client.tokenCache.token;
  }
  const tokenUrl =
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: client.clientId,
    client_secret: client.clientSecret,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`OAuth token fetch failed for ${client.name}: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  client.tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  log.info('[opensky] obtained oauth token', {
    client: client.name,
    expiresInSec: data.expires_in,
  });
  return data.access_token;
};

const buildHeadersForClient = async (
  client: OAuthClient | null
): Promise<HeadersInit> => {
  if (_basic) {
    const enc = Buffer.from(`${_basic.username}:${_basic.password}`).toString('base64');
    return { Authorization: `Basic ${enc}` };
  }
  if (!client) return {};
  const token = await fetchOauthToken(client);
  return { Authorization: `Bearer ${token}` };
};

/* ───────────────────────── fetch with failover ─────────────────────── */

const API_BASE = 'https://opensky-network.org/api';

const buildUrl = (bbox: Bbox): string => {
  const params = new URLSearchParams({
    lamin: bbox.latMin.toString(),
    lomin: bbox.lngMin.toString(),
    lamax: bbox.latMax.toString(),
    lomax: bbox.lngMax.toString(),
  });
  return `${API_BASE}/states/all?${params.toString()}`;
};

export const fetchStatesInBbox = async (bbox: Bbox = GLOBAL_BBOX): Promise<OpenSkyResponse> => {
  const url = buildUrl(bbox);

  // Basic auth path — single attempt
  if (_basic) {
    const headers = await buildHeadersForClient(null);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`OpenSky ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { time: number; states: OpenSkyStateRaw[] | null };
    return { time: data.time, states: (data.states ?? []).map(parseState) };
  }

  // OAuth pool path — try available clients, rotate on 429
  const attempts = _clients?.length ?? 1;
  let lastErr: Error | null = null;
  for (let i = 0; i < attempts; i++) {
    const client = pickAvailableClient();
    if (!client) break;
    const allRateLimited = client.rateLimitedUntil > Date.now();
    try {
      const headers = await buildHeadersForClient(client);
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        // Server tells us we're done — back off this client for an hour
        markRateLimited(client);
        lastErr = new Error(`OpenSky 429 on ${client.name}`);
        if (allRateLimited) break; // we were already trying our last hope
        continue; // try next client
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`OpenSky ${res.status} on ${client.name}: ${body.slice(0, 200)}`);
      }
      const data = (await res.json()) as { time: number; states: OpenSkyStateRaw[] | null };
      return { time: data.time, states: (data.states ?? []).map(parseState) };
    } catch (err) {
      lastErr = err as Error;
      // Non-429 errors: don't burn the client's rate-limit budget
      break;
    }
  }
  throw lastErr ?? new Error('OpenSky: no clients available');
};

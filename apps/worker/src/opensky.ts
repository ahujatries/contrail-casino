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
  number? // 17 category (optional, newer field)
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

type Auth =
  | { kind: 'basic'; username: string; password: string }
  | { kind: 'oauth2'; clientId: string; clientSecret: string }
  | { kind: 'anonymous' };

const detectAuth = (): Auth => {
  const u = process.env.OPENSKY_USERNAME;
  const p = process.env.OPENSKY_PASSWORD;
  const cid = process.env.OPENSKY_CLIENT_ID;
  const csec = process.env.OPENSKY_CLIENT_SECRET;
  if (cid && csec) return { kind: 'oauth2', clientId: cid, clientSecret: csec };
  if (u && p) return { kind: 'basic', username: u, password: p };
  return { kind: 'anonymous' };
};

let _tokenCache: { token: string; expiresAt: number } | null = null;

const fetchOauthToken = async (clientId: string, clientSecret: string): Promise<string> => {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 30_000) {
    return _tokenCache.token;
  }
  const tokenUrl =
    'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    throw new Error(`OAuth token fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  log.info('[opensky] obtained oauth token', { expiresInSec: data.expires_in });
  return data.access_token;
};

const buildHeaders = async (auth: Auth): Promise<HeadersInit> => {
  switch (auth.kind) {
    case 'basic': {
      const enc = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
      return { Authorization: `Basic ${enc}` };
    }
    case 'oauth2': {
      const token = await fetchOauthToken(auth.clientId, auth.clientSecret);
      return { Authorization: `Bearer ${token}` };
    }
    case 'anonymous':
      return {};
  }
};

const API_BASE = 'https://opensky-network.org/api';

export const fetchStatesInBbox = async (bbox: Bbox = GLOBAL_BBOX): Promise<OpenSkyResponse> => {
  const auth = detectAuth();
  const headers = await buildHeaders(auth);
  const params = new URLSearchParams({
    lamin: bbox.latMin.toString(),
    lomin: bbox.lngMin.toString(),
    lamax: bbox.latMax.toString(),
    lomax: bbox.lngMax.toString(),
  });
  const url = `${API_BASE}/states/all?${params.toString()}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenSky ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { time: number; states: OpenSkyStateRaw[] | null };
  return {
    time: data.time,
    states: (data.states ?? []).map(parseState),
  };
};

export const describeAuth = (): string => detectAuth().kind;

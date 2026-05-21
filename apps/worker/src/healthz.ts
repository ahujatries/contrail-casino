import http from 'node:http';
import { clientPoolStatus, describeAuth } from './opensky.ts';
import { log } from './logger.ts';

type HealthState = {
  startedAt: Date;
  lastTickAt: Date | null;
  lastTickStatus: 'ok' | 'failed';
  lastTickError: string | null;
  lastSuccessAt: Date | null;
  totalTicks: number;
  totalSuccesses: number;
  totalFailures: number;
  totalEventsInserted: number;
  pollIntervalMs: number;
  backoffMultiplier: number;
};

const state: HealthState = {
  startedAt: new Date(),
  lastTickAt: null,
  lastTickStatus: 'ok',
  lastTickError: null,
  lastSuccessAt: null,
  totalTicks: 0,
  totalSuccesses: 0,
  totalFailures: 0,
  totalEventsInserted: 0,
  pollIntervalMs: 0,
  backoffMultiplier: 1,
};

export const health = {
  recordTickStart: () => {
    state.lastTickAt = new Date();
    state.totalTicks++;
  },
  recordTickSuccess: (eventsInserted: number) => {
    state.lastTickStatus = 'ok';
    state.lastTickError = null;
    state.lastSuccessAt = new Date();
    state.totalSuccesses++;
    state.totalEventsInserted += eventsInserted;
  },
  recordTickFailure: (error: string) => {
    state.lastTickStatus = 'failed';
    state.lastTickError = error;
    state.totalFailures++;
  },
  setPollIntervalMs: (ms: number) => {
    state.pollIntervalMs = ms;
  },
  setBackoffMultiplier: (m: number) => {
    state.backoffMultiplier = m;
  },
};

const HEALTHY_STALE_THRESHOLD_S = 300; // 5 min

const buildPayload = () => {
  const now = Date.now();
  const lastTickAgeS = state.lastTickAt
    ? Math.floor((now - state.lastTickAt.getTime()) / 1000)
    : null;
  const lastSuccessAgeS = state.lastSuccessAt
    ? Math.floor((now - state.lastSuccessAt.getTime()) / 1000)
    : null;
  const healthy =
    lastSuccessAgeS != null && lastSuccessAgeS < HEALTHY_STALE_THRESHOLD_S;
  return {
    ok: healthy,
    auth: describeAuth(),
    pool: clientPoolStatus(),
    startedAt: state.startedAt.toISOString(),
    uptimeSec: Math.floor((now - state.startedAt.getTime()) / 1000),
    lastTickAt: state.lastTickAt?.toISOString() ?? null,
    lastTickAgeS,
    lastTickStatus: state.lastTickStatus,
    lastTickError: state.lastTickError,
    lastSuccessAt: state.lastSuccessAt?.toISOString() ?? null,
    lastSuccessAgeS,
    totalTicks: state.totalTicks,
    totalSuccesses: state.totalSuccesses,
    totalFailures: state.totalFailures,
    totalEventsInserted: state.totalEventsInserted,
    pollIntervalMs: state.pollIntervalMs,
    backoffMultiplier: state.backoffMultiplier,
    currentIntervalMs: state.pollIntervalMs * state.backoffMultiplier,
  };
};

export const startHealthServer = () => {
  const port = Number(process.env.PORT ?? 8080);
  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (url === '/healthz' || url === '/' || url.startsWith('/healthz?')) {
      const payload = buildPayload();
      res.statusCode = payload.ok ? 200 : 503;
      res.end(JSON.stringify(payload, null, 2));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  });
  server.listen(port, () => {
    log.info('[healthz] http server listening', { port });
  });
  return server;
};

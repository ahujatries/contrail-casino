# Contrail Casino

Live competitive aviation race between JFK, ORD, ATL, and LAX. Real planes on a real
Mapbox map, real takeoffs and landings from the OpenSky Network, play-money bets that
resolve automatically as the events fire. Codebase still named `airport-pong/` for legacy
reasons — user-facing brand is **Contrail Casino**, hosted at `contrail.raghavahuja.com`.

## Stack

- Next.js 15 + Tailwind v4 (apps/web) — Mapbox GL dark map, SSE for live updates
- Node TS polling worker (apps/worker) — 15s OpenSky poll, event detection, bet resolver
- Neon Postgres + Drizzle ORM (packages/db)
- Shared race / odds / geo logic in `@airport-pong/shared`

## Quickstart

```sh
cp .env.example .env.local
# paste DATABASE_URL, DATABASE_URL_DIRECT, OPENSKY_CLIENT_ID/SECRET, NEXT_PUBLIC_MAPBOX_TOKEN

pnpm install
pnpm db:migrate
pnpm worker        # local polling worker
pnpm dev           # Next.js app, separate terminal
```

## Bet types

- **Next Takeoff** — pick which airport gets the next takeoff (quick)
- **Next Heavy** — pick which airport gets the next widebody movement (quick)
- **Landing Race** — two planes on final with ETAs within 60s, pick which lands first (quick)
- **Race Winner** — pick which airport wins this hour's Takeoff/Heavy/Total Ops race (hourly)
- **Race Over/Under** — over or under an auto-suggested line for an airport's hourly count (hourly)
- 10-Min O/U, Streak, Margin — wired in UI as SOON

## Data attribution

Aviation data via [OpenSky Network](https://opensky-network.org). Map tiles via Mapbox.
Play money only — not gambling, no real currency anywhere.

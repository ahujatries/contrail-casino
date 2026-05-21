# syntax=docker/dockerfile:1.7
# Multi-stage build for the airport-pong worker.
# Build context = repo root (monorepo). Built image runs `pnpm --filter worker start`.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
WORKDIR /app

# --- deps stage: install only what the lockfile needs ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --prod=false

# --- runtime stage ---
FROM deps AS runtime
COPY apps/worker ./apps/worker
COPY packages/db ./packages/db
COPY packages/shared ./packages/shared

ENV NODE_ENV=production
ENV WORKER_POLL_INTERVAL_MS=15000

# Avoid loading .env.local — env comes from the platform (Railway dashboard / `railway variables set`).
CMD ["pnpm", "--filter", "worker", "start"]

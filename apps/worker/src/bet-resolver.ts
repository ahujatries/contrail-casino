import { and, eq, sql } from 'drizzle-orm';
import {
  bets as betsTable,
  users as usersTable,
  getDb,
  type Event,
} from '@airport-pong/db';
import {
  describeBet,
  resolveRaceOverUnder,
  type AirportCode,
  type AirportScores,
  type BetPayloadByType,
  type BetTypeKey,
  type RaceType,
} from '@airport-pong/shared';
import { log } from './logger.ts';

type ResolvedBet = {
  betId: number;
  userId: string;
  status: 'won' | 'lost' | 'push';
  stake: number;
  potentialPayout: number;
  label: string;
};

const sendBetNotify = async (resolved: ResolvedBet) => {
  const db = getDb();
  const payload = JSON.stringify({
    type: 'bet_resolved',
    userId: resolved.userId,
    betId: resolved.betId,
    status: resolved.status,
    stake: resolved.stake,
    payout: resolved.status === 'won' ? resolved.potentialPayout : 0,
    label: resolved.label,
  });
  await db.execute(sql`SELECT pg_notify('airport_pong_bets', ${payload})`);
};

const settle = async (
  toResolve: Array<{
    bet: typeof betsTable.$inferSelect;
    status: 'won' | 'lost' | 'push';
    label: string;
  }>
): Promise<void> => {
  if (toResolve.length === 0) return;
  const db = getDb();
  const resolvedNotifs: ResolvedBet[] = [];

  await db.transaction(async (tx) => {
    for (const r of toResolve) {
      await tx
        .update(betsTable)
        .set({ status: r.status, resolvedAt: new Date() })
        .where(eq(betsTable.id, r.bet.id));

      if (r.status === 'won') {
        await tx
          .update(usersTable)
          .set({ balance: sql`${usersTable.balance} + ${r.bet.potentialPayout}` })
          .where(eq(usersTable.id, r.bet.userId));
      } else if (r.status === 'push') {
        // refund the stake
        await tx
          .update(usersTable)
          .set({ balance: sql`${usersTable.balance} + ${r.bet.stake}` })
          .where(eq(usersTable.id, r.bet.userId));
      }

      resolvedNotifs.push({
        betId: r.bet.id,
        userId: r.bet.userId,
        status: r.status,
        stake: r.bet.stake,
        potentialPayout: r.bet.potentialPayout,
        label: r.label,
      });
    }
  });

  for (const n of resolvedNotifs) {
    await sendBetNotify(n);
    log.info('[bet-resolver] settled', {
      betId: n.betId,
      status: n.status,
      payout: n.status === 'won' ? n.potentialPayout : 0,
    });
  }
};

/**
 * Resolve open quick-bets triggered by this event.
 *  - takeoff event → settles next_event bets
 *  - heavy event → settles next_heavy bets
 *  - landing event → settles landing_race bets where either pair member's
 *    icao24 matches the landing aircraft
 */
export const resolveOnEvent = async (
  event: Pick<Event, 'airport' | 'eventType' | 'isHeavy' | 'icao24' | 'occurredAt'>
) => {
  const db = getDb();

  // Quick race-style bets (next_event / next_heavy)
  const quickTypes: BetTypeKey[] = [];
  if (event.eventType === 'takeoff') quickTypes.push('next_event');
  if (event.isHeavy) quickTypes.push('next_heavy');

  if (quickTypes.length > 0) {
    const open = await db
      .select()
      .from(betsTable)
      .where(
        and(
          eq(betsTable.status, 'open'),
          sql`${betsTable.betType} = ANY(${quickTypes})`
        )
      );
    if (open.length > 0) {
      const winnerAirport = event.airport as AirportCode;
      const toResolve = open.map((b) => {
        const payload = b.betPayload as BetPayloadByType['next_event'];
        const status: 'won' | 'lost' = payload.airport === winnerAirport ? 'won' : 'lost';
        return { bet: b, status, label: describeBet(b.betType as BetTypeKey, payload) };
      });
      await settle(toResolve);
    }
  }

  // Landing-race + cross-airport-race bets — resolve on landing
  if (event.eventType === 'landing') {
    const landingBets = await db
      .select()
      .from(betsTable)
      .where(
        and(
          eq(betsTable.status, 'open'),
          sql`${betsTable.betType} IN ('landing_race', 'cross_airport_race')`,
          sql`(${betsTable.betPayload}->>'leftIcao24' = ${event.icao24} OR ${betsTable.betPayload}->>'rightIcao24' = ${event.icao24})`
        )
      );
    if (landingBets.length > 0) {
      const toResolve = landingBets.map((b) => {
        const p = b.betPayload as
          | BetPayloadByType['landing_race']
          | BetPayloadByType['cross_airport_race'];
        const winnerSide = event.icao24 === p.leftIcao24 ? 'left' : 'right';
        const status: 'won' | 'lost' = p.pickedSide === winnerSide ? 'won' : 'lost';
        return { bet: b, status, label: describeBet(b.betType as BetTypeKey, p) };
      });
      await settle(toResolve);
    }

    // Per-plane landing O/U bets — settle by comparing landing time to line
    const planeOuBets = await db
      .select()
      .from(betsTable)
      .where(
        and(
          eq(betsTable.status, 'open'),
          eq(betsTable.betType, 'plane_landing_ou'),
          sql`${betsTable.betPayload}->>'icao24' = ${event.icao24}`
        )
      );
    if (planeOuBets.length > 0) {
      const toResolve = planeOuBets.map((b) => {
        const p = b.betPayload as BetPayloadByType['plane_landing_ou'];
        const lineMs = new Date(p.lineMinuteIso).getTime();
        const actualMs = event.occurredAt.getTime();
        // ±30s of the target minute → push (inside the minute bucket)
        const delta = actualMs - lineMs;
        let status: 'won' | 'lost' | 'push';
        if (Math.abs(delta) <= 30_000) {
          status = 'push';
        } else if (delta < 0) {
          status = p.side === 'under' ? 'won' : 'lost';
        } else {
          status = p.side === 'over' ? 'won' : 'lost';
        }
        return { bet: b, status, label: describeBet('plane_landing_ou', p) };
      });
      await settle(toResolve);
    }
  }

  // Takeoff-race bets — resolve on takeoff (other branch already handled next_event)
  if (event.eventType === 'takeoff') {
    const takeoffBets = await db
      .select()
      .from(betsTable)
      .where(
        and(
          eq(betsTable.status, 'open'),
          eq(betsTable.betType, 'takeoff_race'),
          sql`(${betsTable.betPayload}->>'leftIcao24' = ${event.icao24} OR ${betsTable.betPayload}->>'rightIcao24' = ${event.icao24})`
        )
      );
    if (takeoffBets.length > 0) {
      const toResolve = takeoffBets.map((b) => {
        const p = b.betPayload as BetPayloadByType['takeoff_race'];
        const winnerSide = event.icao24 === p.leftIcao24 ? 'left' : 'right';
        const status: 'won' | 'lost' = p.pickedSide === winnerSide ? 'won' : 'lost';
        return { bet: b, status, label: describeBet('takeoff_race', p) };
      });
      await settle(toResolve);
    }
  }

  // Heavy-race bets — resolve on ANY heavy movement at either of the chosen airports
  if (event.isHeavy) {
    const heavyBets = await db
      .select()
      .from(betsTable)
      .where(
        and(
          eq(betsTable.status, 'open'),
          eq(betsTable.betType, 'heavy_race'),
          sql`(${betsTable.betPayload}->>'leftAirport' = ${event.airport} OR ${betsTable.betPayload}->>'rightAirport' = ${event.airport})`
        )
      );
    if (heavyBets.length > 0) {
      const toResolve = heavyBets.map((b) => {
        const p = b.betPayload as BetPayloadByType['heavy_race'];
        const winnerSide = event.airport === p.leftAirport ? 'left' : 'right';
        const status: 'won' | 'lost' = p.pickedSide === winnerSide ? 'won' : 'lost';
        return { bet: b, status, label: describeBet('heavy_race', p) };
      });
      await settle(toResolve);
    }
  }
};

/**
 * Auto-push plane_landing_ou bets whose plane never landed within 60 min
 * of placement (cancellation, diversion, OpenSky loss-of-signal, etc).
 * Refunds the stake. Run periodically by the worker tick.
 */
export const sweepStalePlaneLandingBets = async (): Promise<number> => {
  const db = getDb();
  const sixtyMinAgo = new Date(Date.now() - 60 * 60_000).toISOString();

  const stale = await db
    .select()
    .from(betsTable)
    .where(
      and(
        eq(betsTable.status, 'open'),
        eq(betsTable.betType, 'plane_landing_ou'),
        sql`${betsTable.betPayload}->>'placedAt' < ${sixtyMinAgo}`
      )
    );

  if (stale.length === 0) return 0;

  const toResolve = stale.map((b) => {
    const p = b.betPayload as BetPayloadByType['plane_landing_ou'];
    return {
      bet: b,
      status: 'push' as const,
      label: describeBet('plane_landing_ou', p) + ' (timeout)',
    };
  });
  await settle(toResolve);
  return stale.length;
};

/**
 * Resolve all open race-tied bets for a given (raceType, hourStart) using the
 * computed final scores. Called from the RaceResolver at top of hour.
 */
export const resolveOnRace = async (
  raceType: RaceType,
  hourStart: Date,
  finalScores: AirportScores
) => {
  const db = getDb();
  const hourIso = hourStart.toISOString();

  const open = await db
    .select()
    .from(betsTable)
    .where(
      and(
        eq(betsTable.status, 'open'),
        sql`${betsTable.betPayload}->>'hourStart' = ${hourIso}`,
        sql`${betsTable.betPayload}->>'raceType' = ${raceType}`
      )
    );

  if (open.length === 0) return;

  // Winner across all 4 airports for race_winner bets
  const sortedAirports = (Object.entries(finalScores) as Array<[AirportCode, number]>)
    .sort((a, b) => b[1] - a[1]);
  const topScore = sortedAirports[0]?.[1] ?? 0;
  const winner = topScore > 0 ? sortedAirports[0][0] : null;

  const toResolve: Array<{
    bet: typeof betsTable.$inferSelect;
    status: 'won' | 'lost' | 'push';
    label: string;
  }> = [];

  for (const b of open) {
    const t = b.betType as BetTypeKey;
    if (t === 'race_winner') {
      const p = b.betPayload as BetPayloadByType['race_winner'];
      const status: 'won' | 'lost' | 'push' = winner == null
        ? 'push'
        : p.airport === winner
          ? 'won'
          : 'lost';
      toResolve.push({ bet: b, status, label: describeBet(t, p) });
    } else if (t === 'race_over_under') {
      const p = b.betPayload as BetPayloadByType['race_over_under'];
      const final = finalScores[p.airport] ?? 0;
      const status = resolveRaceOverUnder(p.line, p.side, final);
      toResolve.push({ bet: b, status, label: describeBet(t, p) });
    }
  }

  await settle(toResolve);
};

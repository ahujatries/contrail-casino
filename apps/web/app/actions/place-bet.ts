'use server';

import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  bets,
  getDb,
  getPaceByAirport,
  getCurrentHourScores,
  users,
} from '@airport-pong/db';
import {
  AIRPORT_CODES,
  MAX_BET,
  MIN_BET,
  getCurrentHourStart,
  msUntilNextHour,
  nextEventOdds,
  raceOverUnderOdds,
  raceWinnerOdds,
  type AirportCode,
  type BetTypeKey,
  type BetPayloadByType,
  type RaceType,
} from '@airport-pong/shared';
import { getCurrentUser } from '../../lib/session';

type AnyPayload = BetPayloadByType[BetTypeKey];

export type PlaceBetResult =
  | { ok: true; betId: number; newBalance: number; potentialPayout: number }
  | { ok: false; error: string };

export async function placeBet(input: {
  type: BetTypeKey;
  payload: AnyPayload;
  stake: number;
}): Promise<PlaceBetResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'No session' };

  const stake = Math.floor(input.stake);
  if (!Number.isFinite(stake) || stake < MIN_BET || stake > MAX_BET) {
    return { ok: false, error: `Stake must be $${MIN_BET}–$${MAX_BET}` };
  }
  if (!validateBet(input.type, input.payload)) {
    return { ok: false, error: 'Invalid bet payload' };
  }

  const { decimalOdds } = await currentDecimalOdds(input.type, input.payload);
  if (!Number.isFinite(decimalOdds) || decimalOdds < 1.01) {
    return { ok: false, error: 'Odds unavailable right now — try again' };
  }
  const potentialPayout = Math.round(stake * decimalOdds);

  const db = getDb();
  try {
    const insertedId = await db.transaction(async (tx) => {
      const fresh = await tx
        .select({ balance: users.balance })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      if (!fresh[0] || fresh[0].balance < stake) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      await tx
        .update(users)
        .set({ balance: sql`${users.balance} - ${stake}`, lastActive: new Date() })
        .where(eq(users.id, user.id));

      const inserted = await tx
        .insert(bets)
        .values({
          userId: user.id,
          betType: input.type,
          betPayload: input.payload,
          stake,
          potentialPayout,
          status: 'open',
        })
        .returning({ id: bets.id });

      // Broadcast bet placement so other tabs of the same user pick it up
      const notifyPayload = JSON.stringify({
        type: 'bet_placed',
        userId: user.id,
        bet: {
          id: inserted[0].id,
          betType: input.type,
          betPayload: input.payload,
          stake,
          potentialPayout,
          status: 'open',
        },
        newBalance: fresh[0].balance - stake,
      });
      await tx.execute(sql`SELECT pg_notify('airport_pong_bets', ${notifyPayload})`);

      return inserted[0].id;
    });

    revalidatePath('/');
    return {
      ok: true,
      betId: insertedId,
      newBalance: user.balance - stake,
      potentialPayout,
    };
  } catch (err) {
    const msg = (err as Error).message;
    if (msg === 'INSUFFICIENT_BALANCE') return { ok: false, error: 'Insufficient balance' };
    return { ok: false, error: 'Something went wrong placing that bet' };
  }
}

function validateBet(type: BetTypeKey, payload: AnyPayload): boolean {
  switch (type) {
    case 'next_event':
    case 'next_heavy': {
      const p = payload as { airport: AirportCode };
      return AIRPORT_CODES.includes(p.airport);
    }
    case 'race_winner': {
      const p = payload as { raceType: RaceType; airport: AirportCode; hourStart: string };
      return (
        AIRPORT_CODES.includes(p.airport) &&
        ['takeoff', 'heavy', 'total_ops'].includes(p.raceType) &&
        !!Date.parse(p.hourStart)
      );
    }
    case 'race_over_under': {
      const p = payload as {
        raceType: RaceType;
        airport: AirportCode;
        line: number;
        side: 'over' | 'under';
        hourStart: string;
      };
      return (
        AIRPORT_CODES.includes(p.airport) &&
        ['takeoff', 'heavy', 'total_ops'].includes(p.raceType) &&
        (p.side === 'over' || p.side === 'under') &&
        Number.isFinite(p.line) &&
        !!Date.parse(p.hourStart)
      );
    }
    case 'landing_race':
    case 'takeoff_race': {
      const p = payload as {
        airport: AirportCode;
        pickedSide: 'left' | 'right';
        leftIcao24: string;
        rightIcao24: string;
      };
      return (
        AIRPORT_CODES.includes(p.airport) &&
        (p.pickedSide === 'left' || p.pickedSide === 'right') &&
        typeof p.leftIcao24 === 'string' &&
        typeof p.rightIcao24 === 'string' &&
        p.leftIcao24.length > 0 &&
        p.rightIcao24.length > 0 &&
        p.leftIcao24 !== p.rightIcao24
      );
    }
    case 'cross_airport_race': {
      const p = payload as {
        leftAirport: AirportCode;
        rightAirport: AirportCode;
        pickedSide: 'left' | 'right';
        leftIcao24: string;
        rightIcao24: string;
      };
      return (
        AIRPORT_CODES.includes(p.leftAirport) &&
        AIRPORT_CODES.includes(p.rightAirport) &&
        p.leftAirport !== p.rightAirport &&
        (p.pickedSide === 'left' || p.pickedSide === 'right') &&
        typeof p.leftIcao24 === 'string' &&
        typeof p.rightIcao24 === 'string' &&
        p.leftIcao24 !== p.rightIcao24
      );
    }
    case 'heavy_race': {
      const p = payload as {
        leftAirport: AirportCode;
        rightAirport: AirportCode;
        pickedSide: 'left' | 'right';
      };
      return (
        AIRPORT_CODES.includes(p.leftAirport) &&
        AIRPORT_CODES.includes(p.rightAirport) &&
        p.leftAirport !== p.rightAirport &&
        (p.pickedSide === 'left' || p.pickedSide === 'right')
      );
    }
    case 'plane_landing_ou': {
      const p = payload as {
        airport: AirportCode;
        icao24: string;
        lineMinuteIso: string;
        side: 'over' | 'under';
        placedAt: string;
        etaMinAtPlacement: number;
      };
      return (
        AIRPORT_CODES.includes(p.airport) &&
        typeof p.icao24 === 'string' &&
        p.icao24.length > 0 &&
        typeof p.lineMinuteIso === 'string' &&
        !!Date.parse(p.lineMinuteIso) &&
        (p.side === 'over' || p.side === 'under') &&
        typeof p.placedAt === 'string' &&
        !!Date.parse(p.placedAt) &&
        typeof p.etaMinAtPlacement === 'number' &&
        p.etaMinAtPlacement > 0
      );
    }
  }
}

async function currentDecimalOdds(
  type: BetTypeKey,
  payload: AnyPayload
): Promise<{ decimalOdds: number }> {
  switch (type) {
    case 'next_event': {
      const pace = await getPaceByAirport(30, 'takeoff');
      const odds = nextEventOdds(pace);
      return { decimalOdds: odds[(payload as { airport: AirportCode }).airport].decimal };
    }
    case 'next_heavy': {
      const pace = await getPaceByAirport(60, 'heavy');
      const odds = nextEventOdds(pace);
      return { decimalOdds: odds[(payload as { airport: AirportCode }).airport].decimal };
    }
    case 'race_winner': {
      const p = payload as { raceType: RaceType; airport: AirportCode; hourStart: string };
      const expectedHourStart = getCurrentHourStart().toISOString();
      if (p.hourStart !== expectedHourStart) {
        // protect against stale clients trying to bet on an old hour
        throw new Error('STALE_HOUR');
      }
      const [scores, takeoffPace, heavyPace, totalPace] = await Promise.all([
        getCurrentHourScores(),
        getPaceByAirport(30, 'takeoff'),
        getPaceByAirport(60, 'heavy'),
        getPaceByAirport(30, 'all'),
      ]);
      const paceByRace = {
        takeoff: takeoffPace,
        heavy: heavyPace,
        total_ops: totalPace,
      } as const;
      const minutesRemaining = Math.max(1, Math.round(msUntilNextHour() / 60_000));
      const odds = raceWinnerOdds({
        currentScores: scores[p.raceType],
        paceByAirport: paceByRace[p.raceType],
        minutesRemaining,
      });
      return { decimalOdds: odds[p.airport].decimal };
    }
    case 'race_over_under': {
      const p = payload as {
        raceType: RaceType;
        airport: AirportCode;
        line: number;
        side: 'over' | 'under';
        hourStart: string;
      };
      const [scores, takeoffPace, heavyPace, totalPace] = await Promise.all([
        getCurrentHourScores(),
        getPaceByAirport(30, 'takeoff'),
        getPaceByAirport(60, 'heavy'),
        getPaceByAirport(30, 'all'),
      ]);
      const paceByRace = {
        takeoff: takeoffPace,
        heavy: heavyPace,
        total_ops: totalPace,
      } as const;
      const minutesRemaining = Math.max(1, Math.round(msUntilNextHour() / 60_000));
      const ou = raceOverUnderOdds({
        currentScore: scores[p.raceType][p.airport],
        pace: paceByRace[p.raceType][p.airport],
        minutesRemaining,
        line: p.line,
      });
      return { decimalOdds: (p.side === 'over' ? ou.over : ou.under).decimal };
    }
    case 'landing_race':
    case 'takeoff_race':
    case 'cross_airport_race': {
      // Paired by ETA / queue position → roughly even, mild house edge
      return { decimalOdds: 1.9 };
    }
    case 'heavy_race': {
      const p = payload as {
        leftAirport: AirportCode;
        rightAirport: AirportCode;
        pickedSide: 'left' | 'right';
      };
      const heavyPace = await getPaceByAirport(60, 'heavy');
      const left = Math.max(0.1, heavyPace[p.leftAirport]);
      const right = Math.max(0.1, heavyPace[p.rightAirport]);
      const total = left + right;
      const probLeft = left / total;
      const probPick = p.pickedSide === 'left' ? probLeft : 1 - probLeft;
      const fair = Math.min(0.92, Math.max(0.08, probPick));
      return { decimalOdds: (1 / fair) * 0.95 };
    }
    case 'plane_landing_ou': {
      // Near-even money. The system-suggested ETA is the line, so true
      // 50/50 in expectation; small house edge so the leaderboard isn't
      // a coin-flip grind.
      return { decimalOdds: 1.95 };
    }
  }
}

export async function refillBalance(): Promise<{ ok: true; balance: number } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'No session' };
  if (user.balance > 0) {
    return { ok: false, error: 'You can only refill at $0' };
  }
  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({ balance: 10000, lastActive: new Date() })
    .where(eq(users.id, user.id))
    .returning({ balance: users.balance });
  revalidatePath('/');
  return { ok: true, balance: updated.balance };
}

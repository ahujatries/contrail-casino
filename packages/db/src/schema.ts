import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  uuid,
  jsonb,
  index,
  serial,
  bigserial,
  doublePrecision,
} from 'drizzle-orm/pg-core';

export const eventTypeEnum = pgEnum('event_type', ['takeoff', 'landing']);
export const raceTypeEnum = pgEnum('race_type', ['takeoff', 'heavy', 'total_ops']);
export const betStatusEnum = pgEnum('bet_status', ['open', 'won', 'lost', 'push']);

export const aircraftTypes = pgTable('aircraft_types', {
  icao24: text('icao24').primaryKey(),
  typecode: text('typecode'),
  registration: text('registration'),
  manufacturer: text('manufacturer'),
  model: text('model'),
  operator: text('operator'),
  isHeavy: boolean('is_heavy').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  'events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    airport: text('airport').notNull(),
    eventType: eventTypeEnum('event_type').notNull(),
    icao24: text('icao24').notNull(),
    callsign: text('callsign'),
    typecode: text('typecode'),
    isHeavy: boolean('is_heavy').notNull().default(false),
    altitudeFt: integer('altitude_ft'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    airportOccurredIdx: index('events_airport_occurred_idx').on(t.airport, t.occurredAt),
    occurredIdx: index('events_occurred_idx').on(t.occurredAt),
    icao24Idx: index('events_icao24_idx').on(t.icao24),
  })
);

export const races = pgTable(
  'races',
  {
    id: serial('id').primaryKey(),
    raceType: raceTypeEnum('race_type').notNull(),
    hourStart: timestamp('hour_start', { withTimezone: true }).notNull(),
    hourEnd: timestamp('hour_end', { withTimezone: true }).notNull(),
    airportA: text('airport_a').notNull(),
    airportB: text('airport_b').notNull(),
    scoreA: integer('score_a').notNull().default(0),
    scoreB: integer('score_b').notNull().default(0),
    winner: text('winner'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => ({
    raceHourIdx: index('races_hour_idx').on(t.hourStart, t.raceType),
  })
);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  callsign: text('callsign').notNull().unique(),
  balance: integer('balance').notNull().default(10000),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastActive: timestamp('last_active', { withTimezone: true }).notNull().defaultNow(),
});

export const bets = pgTable(
  'bets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    raceId: integer('race_id').references(() => races.id, { onDelete: 'set null' }),
    betType: text('bet_type').notNull(),
    betPayload: jsonb('bet_payload').notNull(),
    stake: integer('stake').notNull(),
    potentialPayout: integer('potential_payout').notNull(),
    status: betStatusEnum('status').notNull().default('open'),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => ({
    userStatusIdx: index('bets_user_status_idx').on(t.userId, t.status),
    raceIdx: index('bets_race_idx').on(t.raceId),
  })
);

export const liveAircraft = pgTable(
  'live_aircraft',
  {
    icao24: text('icao24').primaryKey(),
    callsign: text('callsign'),
    typecode: text('typecode'),
    isHeavy: boolean('is_heavy').notNull().default(false),
    nearestAirport: text('nearest_airport'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    altitudeFt: integer('altitude_ft'),
    velocityKt: integer('velocity_kt'),
    headingDeg: integer('heading_deg'),
    verticalRateFpm: integer('vertical_rate_fpm'),
    onGround: boolean('on_ground').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nearestAirportIdx: index('live_aircraft_nearest_idx').on(t.nearestAirport),
  })
);

export type LiveAircraft = typeof liveAircraft.$inferSelect;
export type NewLiveAircraft = typeof liveAircraft.$inferInsert;

export type AircraftType = typeof aircraftTypes.$inferSelect;
export type NewAircraftType = typeof aircraftTypes.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type Race = typeof races.$inferSelect;
export type NewRace = typeof races.$inferInsert;
export type User = typeof users.$inferSelect;
export type Bet = typeof bets.$inferSelect;
export type NewBet = typeof bets.$inferInsert;

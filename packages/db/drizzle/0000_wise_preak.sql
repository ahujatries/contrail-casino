CREATE TYPE "public"."bet_status" AS ENUM('open', 'won', 'lost', 'push');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('takeoff', 'landing');--> statement-breakpoint
CREATE TYPE "public"."race_type" AS ENUM('takeoff', 'heavy', 'total_ops');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "aircraft_types" (
	"icao24" text PRIMARY KEY NOT NULL,
	"typecode" text,
	"registration" text,
	"manufacturer" text,
	"model" text,
	"operator" text,
	"is_heavy" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"race_id" integer,
	"bet_type" text NOT NULL,
	"bet_payload" jsonb NOT NULL,
	"stake" integer NOT NULL,
	"potential_payout" integer NOT NULL,
	"status" "bet_status" DEFAULT 'open' NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"airport" text NOT NULL,
	"event_type" "event_type" NOT NULL,
	"icao24" text NOT NULL,
	"callsign" text,
	"typecode" text,
	"is_heavy" boolean DEFAULT false NOT NULL,
	"altitude_ft" integer,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "races" (
	"id" serial PRIMARY KEY NOT NULL,
	"race_type" "race_type" NOT NULL,
	"hour_start" timestamp with time zone NOT NULL,
	"hour_end" timestamp with time zone NOT NULL,
	"airport_a" text NOT NULL,
	"airport_b" text NOT NULL,
	"score_a" integer DEFAULT 0 NOT NULL,
	"score_b" integer DEFAULT 0 NOT NULL,
	"winner" text,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"callsign" text NOT NULL,
	"balance" integer DEFAULT 10000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_callsign_unique" UNIQUE("callsign")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bets" ADD CONSTRAINT "bets_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bets_user_status_idx" ON "bets" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bets_race_idx" ON "bets" USING btree ("race_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_airport_occurred_idx" ON "events" USING btree ("airport","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_occurred_idx" ON "events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_icao24_idx" ON "events" USING btree ("icao24");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "races_hour_idx" ON "races" USING btree ("hour_start","race_type");
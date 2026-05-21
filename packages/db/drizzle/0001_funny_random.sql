CREATE TABLE IF NOT EXISTS "live_aircraft" (
	"icao24" text PRIMARY KEY NOT NULL,
	"callsign" text,
	"typecode" text,
	"is_heavy" boolean DEFAULT false NOT NULL,
	"nearest_airport" text,
	"latitude" double precision,
	"longitude" double precision,
	"altitude_ft" integer,
	"velocity_kt" integer,
	"heading_deg" integer,
	"vertical_rate_fpm" integer,
	"on_ground" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_aircraft_nearest_idx" ON "live_aircraft" USING btree ("nearest_airport");
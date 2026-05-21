import { parse } from 'csv-parse';
import { Readable } from 'node:stream';
import { sql } from 'drizzle-orm';
import { getDb, aircraftTypes } from '@airport-pong/db';
import { isHeavyTypecode } from '@airport-pong/shared';
import { log } from './logger.ts';

type AircraftInfo = {
  icao24: string;
  typecode: string | null;
  registration: string | null;
  manufacturer: string | null;
  model: string | null;
  operator: string | null;
  isHeavy: boolean;
};

const CSV_SOURCES = [
  // The canonical rolling URL (often available)
  'https://opensky-network.org/datasets/metadata/aircraftDatabase.csv',
  // Dated fallbacks (most recent first) — OpenSky periodically publishes month-stamped versions
  'https://opensky-network.org/datasets/metadata/aircraft-database-complete-2025-10.csv',
  'https://opensky-network.org/datasets/metadata/aircraft-database-complete-2025-07.csv',
  'https://opensky-network.org/datasets/metadata/aircraft-database-complete-2025-04.csv',
];

class AircraftDb {
  private cache = new Map<string, AircraftInfo>();
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    await this.loadFromDb();
    // Kick off CSV refresh in background; don't block startup
    this.loadingPromise = this.loadFromCsv().catch((err) => {
      log.warn('[aircraft-db] CSV bulk load failed, continuing with what we have', {
        error: String(err),
      });
    });
  }

  /** Loads everything we already have in DB into memory. */
  private async loadFromDb(): Promise<void> {
    const db = getDb();
    const rows = await db.select().from(aircraftTypes);
    for (const r of rows) {
      this.cache.set(r.icao24.toLowerCase(), {
        icao24: r.icao24,
        typecode: r.typecode,
        registration: r.registration,
        manufacturer: r.manufacturer,
        model: r.model,
        operator: r.operator,
        isHeavy: r.isHeavy,
      });
    }
    log.info('[aircraft-db] loaded from DB', { rows: rows.length });
  }

  /** Streams the OpenSky CSV and upserts into DB + cache. */
  private async loadFromCsv(): Promise<void> {
    let res: Response | null = null;
    let usedUrl = '';
    for (const url of CSV_SOURCES) {
      try {
        const r = await fetch(url);
        if (r.ok) {
          res = r;
          usedUrl = url;
          break;
        }
      } catch (err) {
        log.warn('[aircraft-db] CSV source failed', { url, error: String(err) });
      }
    }
    if (!res || !res.body) {
      throw new Error('No aircraft DB CSV source returned 200');
    }
    log.info('[aircraft-db] downloading CSV', { url: usedUrl });

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    });

    // Convert web ReadableStream → Node Readable
    const nodeStream = Readable.fromWeb(res.body as never);
    nodeStream.pipe(parser);

    const batch: AircraftInfo[] = [];
    const BATCH_SIZE = 1000;
    let total = 0;

    const flush = async () => {
      if (batch.length === 0) return;
      const db = getDb();
      await db
        .insert(aircraftTypes)
        .values(
          batch.map((a) => ({
            icao24: a.icao24,
            typecode: a.typecode,
            registration: a.registration,
            manufacturer: a.manufacturer,
            model: a.model,
            operator: a.operator,
            isHeavy: a.isHeavy,
          }))
        )
        .onConflictDoUpdate({
          target: aircraftTypes.icao24,
          set: {
            typecode: sql`excluded.typecode`,
            registration: sql`excluded.registration`,
            manufacturer: sql`excluded.manufacturer`,
            model: sql`excluded.model`,
            operator: sql`excluded.operator`,
            isHeavy: sql`excluded.is_heavy`,
            updatedAt: sql`now()`,
          },
        });
      batch.length = 0;
    };

    for await (const row of parser) {
      const icao24 = String(row.icao24 || '').toLowerCase().trim();
      if (!icao24) continue;
      const typecode = String(row.typecode || '').trim() || null;
      const info: AircraftInfo = {
        icao24,
        typecode,
        registration: String(row.registration || '').trim() || null,
        manufacturer: String(row.manufacturericao || row.manufacturername || '').trim() || null,
        model: String(row.model || '').trim() || null,
        operator: String(row.operator || '').trim() || null,
        isHeavy: isHeavyTypecode(typecode),
      };
      this.cache.set(icao24, info);
      batch.push(info);
      total++;
      if (batch.length >= BATCH_SIZE) {
        await flush();
      }
    }
    await flush();
    this.loaded = true;
    log.info('[aircraft-db] CSV load complete', { total });
  }

  get(icao24: string): AircraftInfo | undefined {
    return this.cache.get(icao24.toLowerCase());
  }

  /** Returns the typecode for an icao24, or null if unknown. */
  typecodeFor(icao24: string): string | null {
    return this.cache.get(icao24.toLowerCase())?.typecode ?? null;
  }

  isHeavy(icao24: string): boolean {
    const info = this.cache.get(icao24.toLowerCase());
    if (!info) return false;
    return info.isHeavy || isHeavyTypecode(info.typecode);
  }

  size(): number {
    return this.cache.size;
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

export const aircraftDb = new AircraftDb();

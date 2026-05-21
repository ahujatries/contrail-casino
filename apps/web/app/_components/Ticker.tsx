'use client';

import { type AirportCode } from '@airport-pong/shared';

export type TickerEvent = {
  id: number;
  airport: string;
  eventType: 'takeoff' | 'landing';
  callsign: string | null;
  typecode: string | null;
  isHeavy: boolean;
  occurredAt: string;
};

const lc = (a: string) => a.toLowerCase();

export function TickerTape({ events }: { events: TickerEvent[] }) {
  // Duplicate the strand so the CSS infinite scroll has something to roll into.
  const strand = events.length > 0 ? [...events, ...events] : [];
  return (
    <div className="event-tape">
      <span className="label">
        <span className="pip" />
        Live feed
      </span>
      <div className="tape-track">
        {strand.length === 0 && (
          <span className="tape-event" style={{ color: 'var(--ink-3)' }}>
            Listening for events…
          </span>
        )}
        {strand.map((e, i) => (
          <span key={`${e.id}-${i}`} className="tape-event">
            <span className={`ap ${lc(e.airport)}`}>{e.airport}</span>
            <span className="ev">{e.eventType}</span>
            <span className="cs">{e.callsign ?? '???'}</span>
            {e.typecode && (
              <>
                <span style={{ color: 'var(--ink-3)' }}>·</span>
                <span style={{ color: 'var(--ink-2)', fontSize: 10.5 }}>{e.typecode}</span>
              </>
            )}
            {e.isHeavy && <span className="heavy">HVY</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

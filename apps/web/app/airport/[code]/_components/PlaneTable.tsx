'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type { AirportCode } from '@airport-pong/shared';
import type { DepartingPlane, InboundPlane } from '@airport-pong/db';
import { placeBet } from '../../../actions/place-bet';

type Direction = 'landing' | 'takeoff';

type Props = {
  airport: AirportCode;
  inbound: InboundPlane[];
  departing: DepartingPlane[];
  selectedIcao24: string | null;
  onSelect: (icao: string | null) => void;
  stake: number;
  balance: number;
  onBalanceChange: (newBal: number) => void;
};

const MIN_STAKE = 10;
const MAX_STAKE = 1000;

/**
 * BET 2 card: tabbed Inbound | Departing list with inline-expanding bet
 * drawer per row. Stake is shared with BET 1 (no separate stake input here).
 */
export function PlaneTable({
  airport,
  inbound,
  departing,
  selectedIcao24,
  onSelect,
  stake,
  balance,
  onBalanceChange,
}: Props) {
  const [tab, setTab] = useState<Direction>('landing');

  // Close expanded row when switching tabs
  useEffect(() => {
    onSelect(null);
  }, [tab, onSelect]);

  return (
    <section className="ad-card">
      <div className="ad-card-head">
        <div className="ad-card-num mono">BET 2</div>
        <h2 className="ad-card-title">Pick a plane · bet its event time</h2>
        <div className="ad-card-tabs">
          <button className={tab === 'landing' ? 'on' : ''} onClick={() => setTab('landing')}>
            Inbound · {inbound.length}
          </button>
          <button className={tab === 'takeoff' ? 'on' : ''} onClick={() => setTab('takeoff')}>
            Departing · {departing.length}
          </button>
        </div>
      </div>

      <p className="ad-card-explainer">
        {tab === 'landing'
          ? <>Each inbound aircraft has its own ETA line. Pick a plane → bet whether it lands sooner or later than its line. Bets lock when ETA &lt; 8 min.</>
          : <>Each taxiing plane has a system-estimated time-to-wheels-up (ETT). Pick a plane → bet over/under its line. Bets lock when ETT &lt; 4 min.</>}
      </p>

      {tab === 'landing'
        ? <PlaneList
            airport={airport}
            direction="landing"
            planes={inbound}
            selectedIcao24={selectedIcao24}
            onSelect={onSelect}
            stake={stake}
            balance={balance}
            onBalanceChange={onBalanceChange}
          />
        : <PlaneList
            airport={airport}
            direction="takeoff"
            planes={departing}
            selectedIcao24={selectedIcao24}
            onSelect={onSelect}
            stake={stake}
            balance={balance}
            onBalanceChange={onBalanceChange}
          />}
    </section>
  );
}

type ListProps = {
  airport: AirportCode;
  direction: Direction;
  planes: InboundPlane[] | DepartingPlane[];
  selectedIcao24: string | null;
  onSelect: (icao: string | null) => void;
  stake: number;
  balance: number;
  onBalanceChange: (newBal: number) => void;
};

function PlaneList({
  airport,
  direction,
  planes,
  selectedIcao24,
  onSelect,
  stake,
  balance,
  onBalanceChange,
}: ListProps) {
  if (planes.length === 0) {
    return (
      <div className="plane-empty mono">
        {direction === 'landing'
          ? 'NO BETTABLE INBOUND AIRCRAFT · WAITING FOR PLANES > 8 MIN OUT'
          : 'NO BETTABLE DEPARTING AIRCRAFT · WAITING FOR PLANES > 4 MIN FROM WHEELS-UP'}
      </div>
    );
  }
  return (
    <div className="plane-table">
      <div className="plane-table-head mono">
        <div>CALLSIGN</div>
        <div>TYPE</div>
        <div className="num">{direction === 'landing' ? 'ETA' : 'ETT'}</div>
        <div className="num">{direction === 'landing' ? 'DIST' : 'SPD'}</div>
        <div>LINE</div>
        <div></div>
      </div>
      <ul className="plane-list">
        {planes.map((p) => (
          <PlaneRow
            key={p.icao24}
            airport={airport}
            direction={direction}
            plane={p}
            open={selectedIcao24 === p.icao24}
            onToggle={() => onSelect(selectedIcao24 === p.icao24 ? null : p.icao24)}
            stake={stake}
            balance={balance}
            onBalanceChange={onBalanceChange}
          />
        ))}
      </ul>
    </div>
  );
}

function PlaneRow({
  airport,
  direction,
  plane,
  open,
  onToggle,
  stake,
  balance,
  onBalanceChange,
}: {
  airport: AirportCode;
  direction: Direction;
  plane: InboundPlane | DepartingPlane;
  open: boolean;
  onToggle: () => void;
  stake: number;
  balance: number;
  onBalanceChange: (newBal: number) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLanding = direction === 'landing';
  const eventMin = isLanding
    ? (plane as InboundPlane).etaMin
    : (plane as DepartingPlane).ettMin;
  const eventIso = isLanding
    ? (plane as InboundPlane).expectedLandingAt
    : (plane as DepartingPlane).expectedTakeoffAt;
  const distOrSpd = isLanding
    ? `${Math.round((plane as InboundPlane).distanceNm)}nm`
    : `${(plane as DepartingPlane).velocityKt}kt`;
  const lockSoon = isLanding ? eventMin <= 10 : eventMin <= 6;
  const eventVerb = isLanding ? 'lands' : 'takes off';

  // Snap the line to start of projected minute
  const { lineMinuteIso, lineLabel } = useMemo(() => {
    const t = new Date(eventIso);
    t.setUTCSeconds(0, 0);
    return { lineMinuteIso: t.toISOString(), lineLabel: t.toISOString().slice(11, 16) };
  }, [eventIso]);

  // Simple odds — slight delta from even based on direction confidence
  const overOdds = isLanding ? '+105' : '+110';
  const underOdds = isLanding ? '-125' : '-130';

  const place = (side: 'over' | 'under') => {
    if (stake < MIN_STAKE) return setError(`Min stake $${MIN_STAKE}`);
    if (stake > MAX_STAKE) return setError(`Max stake $${MAX_STAKE}`);
    if (stake > balance) return setError('Insufficient balance');
    setError(null);
    startTransition(async () => {
      const payload = isLanding
        ? {
            airport,
            icao24: plane.icao24,
            callsign: plane.callsign,
            typecode: plane.typecode,
            lineMinuteIso,
            side,
            etaMinAtPlacement: eventMin,
            placedAt: new Date().toISOString(),
          }
        : {
            airport,
            icao24: plane.icao24,
            callsign: plane.callsign,
            typecode: plane.typecode,
            lineMinuteIso,
            side,
            ettMinAtPlacement: eventMin,
            placedAt: new Date().toISOString(),
          };
      const res = await placeBet({
        type: isLanding ? 'plane_landing_ou' : 'plane_takeoff_ou',
        payload,
        stake,
      } as Parameters<typeof placeBet>[0]);
      if ('ok' in res && res.ok) {
        onBalanceChange(res.newBalance);
        onToggle(); // close drawer
      } else if ('error' in res) {
        setError(res.error ?? 'Bet failed');
      }
    });
  };

  return (
    <li className={`plane-row ${open ? 'open' : ''} ${lockSoon ? 'lock-soon' : ''}`}>
      <button className="plane-row-btn" onClick={onToggle}>
        <div className="plane-cs">
          {plane.callsign ?? plane.icao24.toUpperCase()}
          {plane.isHeavy && <span className="plane-h">H</span>}
        </div>
        <div className="plane-type mono">{plane.typecode ?? '—'}</div>
        <div className="num plane-eta">{Math.round(eventMin)}m</div>
        <div className="num plane-dist mono">{distOrSpd}</div>
        <div className="plane-line">line {lineLabel} UTC</div>
        <div className="plane-arrow">{open ? '▼' : '▶'}</div>
      </button>

      {open && (
        <div className="plane-bet-open">
          <div className="pbo-info">
            <div className="pbo-q">
              Will <strong>{plane.callsign ?? plane.icao24.toUpperCase()}</strong>{' '}
              {eventVerb} <strong>before {lineLabel}</strong> or{' '}
              <strong>after {lineLabel}</strong>?
            </div>
            <div className="pbo-meta mono">
              {plane.typecode ?? '—'}
              {plane.isHeavy ? ' · H' : ''} · {distOrSpd}
              {isLanding && (plane as InboundPlane).altitudeFt != null
                ? ` · ${(plane as InboundPlane).altitudeFt}ft`
                : ''}{' '}
              · ±30s of line → push
            </div>
          </div>
          <div className="pbo-picks">
            <button
              type="button"
              className="pbo-pick"
              disabled={pending}
              onClick={() => place('under')}
            >
              <span className="lbl">{eventVerb === 'lands' ? 'Lands' : 'Takes off'} BEFORE {lineLabel}</span>
              <span className="odds mono">{underOdds}</span>
            </button>
            <button
              type="button"
              className="pbo-pick"
              disabled={pending}
              onClick={() => place('over')}
            >
              <span className="lbl">{eventVerb === 'lands' ? 'Lands' : 'Takes off'} AFTER {lineLabel}</span>
              <span className="odds mono">{overOdds}</span>
            </button>
          </div>
          <div className="pbo-stake mono">
            STAKE ${stake} · CHANGE IN BET 1 ABOVE
          </div>
          {error && <div className="pbo-stake" style={{ color: 'var(--neg)' }}>{error}</div>}
        </div>
      )}
    </li>
  );
}

'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { AIRPORT_CODES, type AirportCode, type BetTypeKey } from '@airport-pong/shared';
import type { BoardCategory, BoardMarket, BoardPick } from '../../api/markets/route';
import { placeBet } from '../../actions/place-bet';

const POLL_MS = 30_000;
const STAKE_PRESETS = [25, 50, 100, 250];
const MIN_STAKE = 10;
const MAX_STAKE = 1000;

const CATEGORIES: Record<BoardCategory, { title: string; sub: string; short: string }> = {
  hourly:  { short: 'HOURLY O/U',   title: 'Hourly Over / Under',   sub: 'RESOLVES AT XX:00 UTC' },
  landing: { short: 'LANDING TIME', title: 'Live Landings',         sub: 'PER-PLANE O/U · LOCKS AT 8MIN ETA' },
  takeoff: { short: 'TAKEOFF TIME', title: 'Live Takeoffs',         sub: 'PER-PLANE O/U · LOCKS AT 4MIN ETT' },
};

type Props = { userId: string; initialBalance: number };

export function BoardScreen({ userId: _userId, initialBalance }: Props) {
  const [markets, setMarkets] = useState<BoardMarket[]>([]);
  const [balance, setBalance] = useState(initialBalance);
  const [stake, setStake] = useState(100);
  const [filter, setFilter] = useState<'all' | AirportCode>('all');
  const [category, setCategory] = useState<'all' | BoardCategory>('all');
  const [openSlip, setOpenSlip] = useState<{ mktId: string; pickIdx: number } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Poll markets every 30s
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/markets', { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as { markets: BoardMarket[] };
        if (!cancelled) setMarkets(data.markets);
      } catch {
        // silent
      }
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Apply filters
  const filtered = useMemo(() => markets.filter((m) => {
    if (filter !== 'all' && m.airport !== filter) return false;
    if (category !== 'all' && m.category !== category) return false;
    return true;
  }), [markets, filter, category]);

  // Group by category for section headers
  const byCategory = useMemo(() => {
    const out: Record<BoardCategory, BoardMarket[]> = { hourly: [], landing: [], takeoff: [] };
    for (const m of filtered) out[m.category].push(m);
    return out;
  }, [filtered]);

  const place = (mkt: BoardMarket, pick: BoardPick) => {
    if (stake < MIN_STAKE) return setError(`Min stake $${MIN_STAKE}`);
    if (stake > MAX_STAKE) return setError(`Max stake $${MAX_STAKE}`);
    if (stake > balance) return setError('Insufficient balance');
    setError(null);
    setSuccess(null);
    setPendingId(mkt.id);
    startTransition(async () => {
      const res = await placeBet({
        type: pick.betType as BetTypeKey,
        payload: pick.payload,
        stake,
      } as Parameters<typeof placeBet>[0]);
      setPendingId(null);
      if ('ok' in res && res.ok) {
        setBalance(res.newBalance);
        setSuccess(`${mkt.title} · ${pick.label} · $${stake}`);
        setOpenSlip(null);
        setTimeout(() => setSuccess(null), 3500);
      } else if ('error' in res) {
        setError(res.error ?? 'Bet failed');
      }
    });
  };

  return (
    <div className="board-inner">
      <div className="board-head">
        <div className="board-head-l">
          <div className="board-kicker mono">LIVE · {markets.length} OPEN MARKETS</div>
          <h1 className="board-title">Bet Board</h1>
          <p className="board-sub">
            Every open market across all four airports. Tap any odds to lock in your pick at
            your current stake.
          </p>
        </div>
        <div className="board-head-r">
          <div className="board-stake">
            <div className="bs-k mono">STAKE PER BET</div>
            <div className="bs-row">
              {STAKE_PRESETS.map((v) => (
                <button key={v} className={stake === v ? 'on' : ''} onClick={() => setStake(v)}>${v}</button>
              ))}
            </div>
            <div className="bs-input">
              <span className="g">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={stake}
                onChange={(e) => {
                  const n = parseInt(String(e.target.value).replace(/[^\d]/g, ''), 10);
                  setStake(Number.isNaN(n) ? 0 : Math.min(MAX_STAKE, Math.max(0, n)));
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="board-filters">
        <div className="bf-group">
          <span className="bf-label mono">AIRPORT</span>
          {(['all', ...AIRPORT_CODES] as const).map((id) => (
            <button
              key={id}
              className={`board-filter ${id !== 'all' ? `airport-${id.toLowerCase()}` : ''} ${filter === id ? 'on' : ''}`}
              onClick={() => setFilter(id)}
            >
              {id !== 'all' && <span className="led" />}
              {id === 'all' ? 'All' : id}
            </button>
          ))}
        </div>
        <div className="bf-group">
          <span className="bf-label mono">TYPE</span>
          {(['all', 'hourly', 'landing', 'takeoff'] as const).map((id) => (
            <button
              key={id}
              className={`board-filter ${category === id ? 'on' : ''}`}
              onClick={() => setCategory(id)}
            >
              {id === 'all' ? 'All' : CATEGORIES[id].short}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="board-empty" style={{ color: 'var(--neg)' }}>{error}</div>}
      {success && (
        <div className="board-empty" style={{ color: 'var(--pos)', padding: '12px 20px' }}>
          ✓ Bet placed: {success}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="board-empty mono">
          {markets.length === 0
            ? 'LOADING MARKETS…'
            : 'NO MARKETS MATCH THE CURRENT FILTERS'}
        </div>
      )}

      {(['hourly', 'landing', 'takeoff'] as const).map((catId) => {
        const list = byCategory[catId];
        if (list.length === 0) return null;
        const cat = CATEGORIES[catId];
        return (
          <section key={catId} className={`board-section cat-${catId}`}>
            <div className="board-section-head">
              <div className="bs-num mono">{list.length}</div>
              <h2 className="bs-title">{cat.title}</h2>
              <div className="bs-sub mono">{cat.sub}</div>
            </div>
            <ul className="market-list">
              {list.map((m) => {
                const slipOpen = openSlip?.mktId === m.id;
                const slipPick = slipOpen ? m.picks[openSlip!.pickIdx] : null;
                const dec = slipPick ? americanToDecimal(slipPick.odds) : 0;
                const win = slipPick ? Math.round(stake * dec - stake) : 0;
                return (
                  <li key={m.id} className={`market-row ${slipOpen ? 'open' : ''} ${m.locked ? 'locked' : ''}`}>
                    <div className="mr-main">
                      <div className="mr-info">
                        <span className={`mr-led airport-${m.airport.toLowerCase()}`} />
                        <div className="mr-text">
                          <div className="mr-title">{m.title}</div>
                          <div className="mr-sub mono">{m.sub}</div>
                        </div>
                      </div>
                      <div className={`mr-picks count-${m.picks.length}`}>
                        {m.picks.map((p, i) => (
                          <button
                            key={i}
                            className={`mr-pick ${slipOpen && openSlip!.pickIdx === i ? 'on' : ''}`}
                            disabled={m.locked}
                            onClick={() =>
                              setOpenSlip(
                                slipOpen && openSlip!.pickIdx === i ? null : { mktId: m.id, pickIdx: i }
                              )
                            }
                          >
                            <span className="mp-lbl">{p.label}</span>
                            <span className="mp-odds mono">{m.locked ? 'LOCKED' : p.odds}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {slipOpen && slipPick && (
                      <div className="mr-slip">
                        <div>
                          <div className="mrs-k mono">YOUR PICK</div>
                          <div className="mrs-v">{slipPick.label} <span className="mono" style={{ color: 'var(--accent, var(--blue-1))' }}>{slipPick.odds}</span></div>
                        </div>
                        <div>
                          <div className="mrs-k mono">STAKE</div>
                          <div className="mrs-v mono">${stake}</div>
                        </div>
                        <div>
                          <div className="mrs-k mono">TO WIN</div>
                          <div className="mrs-v win">${win.toLocaleString()}</div>
                        </div>
                        <button
                          className="mrs-go"
                          onClick={() => place(m, slipPick)}
                          disabled={pendingId === m.id || stake < MIN_STAKE || stake > balance}
                        >
                          {pendingId === m.id ? 'Placing…' : 'Place bet →'}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div className="picker-foot mono" style={{ marginTop: 24 }}>
        BALANCE: ${balance.toLocaleString()} · MIN $10 · MAX $1,000 · ALL TIMES UTC
      </div>
    </div>
  );
}

function americanToDecimal(american: string): number {
  const n = parseInt(american, 10);
  if (Number.isNaN(n)) return 1;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

'use client';

import { useState, useTransition } from 'react';
import {
  MAX_BET,
  MIN_BET,
  type BetPayloadByType,
  type BetTypeKey,
} from '@airport-pong/shared';
import { placeBet } from '../../actions/place-bet';

type Props = {
  betType: BetTypeKey;
  payload: BetPayloadByType[BetTypeKey] | null;
  decimalOdds: number; // for display
  americanOdds: number; // for display
  balance: number;
  ctaLabel?: string;
  onPlaced?: (newBalance: number) => void;
};

const fmtMoney = (n: number) => Math.round(n).toLocaleString('en-US');
const fmtAmerican = (a: number) => (a > 0 ? `+${a}` : `${a}`);

export function StakeAndPlace({
  betType,
  payload,
  decimalOdds,
  americanOdds,
  balance,
  ctaLabel,
  onPlaced,
}: Props) {
  const [stake, setStake] = useState(100);
  const [pending, setPending] = useState(false);
  const [flash, setFlash] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [, startTransition] = useTransition();

  const profit = Math.round(stake * decimalOdds) - stake;
  const canPlace =
    payload != null &&
    stake >= MIN_BET &&
    stake <= MAX_BET &&
    stake <= balance &&
    !pending;

  const submit = () => {
    if (!payload) {
      setFlash({ kind: 'err', msg: 'PICK YOUR SIDE FIRST' });
      return;
    }
    if (stake < MIN_BET || stake > MAX_BET) {
      setFlash({ kind: 'err', msg: `STAKE MUST BE $${MIN_BET}–$${MAX_BET}` });
      return;
    }
    if (stake > balance) {
      setFlash({ kind: 'err', msg: 'STAKE EXCEEDS BALANCE' });
      return;
    }
    setPending(true);
    startTransition(async () => {
      const r = await placeBet({ type: betType, payload, stake });
      setPending(false);
      if (r.ok) {
        setFlash({ kind: 'ok', msg: `BET PLACED · risk ✈$${stake} to win ✈$${r.potentialPayout}` });
        onPlaced?.(r.newBalance);
      } else {
        setFlash({ kind: 'err', msg: r.error.toUpperCase() });
      }
      setTimeout(() => setFlash(null), 3000);
    });
  };

  return (
    <div className="stake-and-place">
      <div className="stake-row">
        <div className="stake-label">
          <span>Stake (UTC live odds)</span>
          <span>min ✈$10 · max ✈$1,000 · balance ✈${fmtMoney(balance)}</span>
        </div>
        <div className="stake-input">
          <span className="glyph">✈$</span>
          <input
            type="text"
            inputMode="numeric"
            value={stake}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/[^\d]/g, ''), 10);
              setStake(Number.isNaN(n) ? 0 : Math.min(MAX_BET, Math.max(0, n)));
            }}
          />
        </div>
        <div className="stake-chips">
          {[25, 50, 100, 250, 500].map((v) => (
            <button key={v} onClick={() => setStake(v)}>
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="payout-summary">
        <span className="k">To win</span>
        <span>
          <span className="v">✈ ${fmtMoney(profit)}</span>
          <span className="mult">
            {decimalOdds.toFixed(2)}x · {fmtAmerican(americanOdds)}
          </span>
        </span>
      </div>

      {flash && (
        <div
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            padding: '8px 10px',
            borderRadius: 6,
            border: `0.5px solid ${flash.kind === 'ok' ? 'var(--pos)' : 'var(--neg)'}`,
            color: flash.kind === 'ok' ? 'var(--pos)' : 'var(--neg)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {flash.msg}
        </div>
      )}

      <button className="place-btn" onClick={submit} disabled={!canPlace}>
        {pending ? 'Placing…' : `${ctaLabel ?? 'Place'} ✈ $${fmtMoney(stake)} →`}
      </button>
    </div>
  );
}

'use client';

export type Toast = {
  id: number;
  kind: 'won' | 'lost' | 'push';
  label: string;
  amount: number;
};

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-card ${t.kind}`}>
          <div className="k">
            {t.kind === 'won' ? 'HOUSE PAYS' : t.kind === 'lost' ? 'HOUSE KEEPS' : 'PUSH · STAKE REFUNDED'}
          </div>
          <div className="desc">{t.label}</div>
          <div className="amount">
            {t.kind === 'won' ? '+' : t.kind === 'lost' ? '-' : ''}✈ $
            {t.amount.toLocaleString('en-US')}
          </div>
        </div>
      ))}
    </div>
  );
}

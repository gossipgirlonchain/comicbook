'use client';

import * as React from 'react';
import { usePrivy } from '@privy-io/react-auth';

const STORAGE_KEY = 'cb-how-to-play-seen';

/**
 * Shows a one-time "How to Play" modal the first time an authenticated user
 * lands on the app. Dismissal is persisted to localStorage.
 *
 * TODO: final copy from ComicBook.com team.
 */
export default function HowToPlayModal() {
  const { authenticated, ready } = usePrivy();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!ready || !authenticated) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === '1') return;
      setOpen(true);
    } catch {
      /* localStorage unavailable */
    }
  }, [ready, authenticated]);

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* noop */
    }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overlay-enter p-4"
      style={{ background: 'rgba(8, 13, 26, 0.85)' }}
      onClick={close}
    >
      <div
        className="relative max-w-lg w-full rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-6 space-y-5 reveal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute top-3 right-3 w-8 h-8 rounded-full text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--cb-surface-hover)] flex items-center justify-center text-lg"
          aria-label="Close"
        >
          &times;
        </button>

        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cb-bug-yellow.png" alt="" className="w-10 h-10" />
          <div>
            <h2 className="text-xl font-bold">How to Play</h2>
            <p className="text-xs text-[var(--cb-text-muted)]">
              Welcome to the ComicBook.com Machine
            </p>
          </div>
        </div>

        <ol className="space-y-4">
          <Step
            n={1}
            title="Add funds"
            body="Buy with card, Apple Pay, or Google Pay. Funds arrive in seconds."
          />
          <Step
            n={2}
            title="Pick a tier"
            body="Choose $25, $50, or $250 tiers. Higher tiers contain higher-value cards."
          />
          <Step
            n={3}
            title="Pull the machine"
            body="Pull 1, 2, 5, 10, or 20 times at once. Every card is a real, graded collectible."
          />
          <Step
            n={4}
            title="Keep or cash out"
            body="Keep it in your collection or sell it back to the house for 85% of its insured value — instantly."
          />
        </ol>

        <div className="rounded-xl bg-[var(--cb-accent)]/10 border border-[var(--cb-accent)]/30 p-3">
          <p className="text-xs text-[var(--cb-text)]">
            <strong className="text-[var(--cb-accent)]">Guaranteed:</strong>{' '}
            Every card is authenticated and insured. No duds, no fakes.
          </p>
        </div>

        <button
          onClick={close}
          className="w-full py-3 rounded-xl bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] font-bold text-sm transition-colors"
        >
          Let&apos;s Go
        </button>
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[var(--cb-accent)]/15 text-[var(--cb-accent)] font-bold text-sm flex items-center justify-center">
        {n}
      </div>
      <div>
        <p className="text-sm font-bold text-[var(--cb-text)]">{title}</p>
        <p className="text-xs text-[var(--cb-text-muted)] mt-0.5">{body}</p>
      </div>
    </li>
  );
}

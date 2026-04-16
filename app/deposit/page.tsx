'use client';

import * as React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import PrivyConnect from '@/app/components/PrivyConnect';

export default function DepositPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [buyLoading, setBuyLoading] = React.useState(false);
  const [buyError, setBuyError] = React.useState<string | null>(null);

  const openCoinbaseOnramp = async () => {
    if (!wallet?.address) return;
    setBuyError(null);
    setBuyLoading(true);

    try {
      const res = await fetch('/api/coinbase/onramp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wallet.address }),
      });

      const data = await res.json();

      if (!res.ok) {
        setBuyError(data.error || 'Failed to open Coinbase');
        return;
      }

      window.open(data.url, '_blank', 'width=460,height=720,noopener');
    } catch {
      setBuyError('Failed to connect to Coinbase');
    } finally {
      setBuyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[600px] mx-auto w-full px-4 py-8">
        {!ready ? (
          <div className="flex justify-center py-20">
            <div className="spinner spinner-lg" />
          </div>
        ) : !authenticated ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-[var(--cb-text-muted)] text-lg">
              Log in to deposit funds.
            </p>
            <PrivyConnect />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Add Funds</h1>
              <p className="text-sm text-[var(--cb-text-muted)] mt-1">
                Top up your balance to open packs.
              </p>
            </div>

            {/* Buy with Card */}
            <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--cb-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[var(--cb-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                    <line x1="1" y1="10" x2="23" y2="10" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold">Buy with Card</h2>
                  <p className="text-xs text-[var(--cb-text-muted)]">
                    Apple Pay, Google Pay, or debit card
                  </p>
                </div>
              </div>

              <button
                onClick={openCoinbaseOnramp}
                disabled={buyLoading}
                className="w-full py-3 rounded-xl bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] font-bold text-sm transition-colors disabled:opacity-50"
              >
                {buyLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                    Opening checkout...
                  </span>
                ) : (
                  'Add Funds'
                )}
              </button>

              {buyError && (
                <p className="text-xs text-[var(--cb-error)] text-center">{buyError}</p>
              )}

              <p className="text-[10px] text-[var(--cb-text-muted)] text-center">
                Funds arrive in seconds.
              </p>
            </div>

            {/* Test mode faucet */}
            {process.env.NEXT_PUBLIC_SOLANA_NETWORK !== 'mainnet-beta' && (
              <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--cb-warning)]" />
                  <span className="text-xs font-semibold text-[var(--cb-warning)]">
                    Test Mode
                  </span>
                </div>
                <p className="text-xs text-[var(--cb-text-muted)]">
                  Get free test funds to try out the machine.
                </p>
                <a
                  href="https://spl-token-faucet.com/?token-name=USDC-Dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 rounded-lg border border-[var(--cb-border)] text-sm font-semibold text-[var(--cb-accent)] hover:bg-[var(--cb-surface-hover)] transition-colors"
                >
                  Get Test Funds
                </a>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

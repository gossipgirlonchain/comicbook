'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useState, useEffect } from 'react';

export default function PrivyConnect() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];
  const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    if (!authenticated || !wallet?.address) {
      setUsdcBalance(null);
      return;
    }

    let alive = true;

    const fetchBalance = async () => {
      setLoadingBalance(true);
      try {
        const res = await fetch('/api/getUsdcBalance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: wallet.address }),
        });
        if (res.ok && alive) {
          const data = await res.json();
          setUsdcBalance(data.balance ?? 0);
        }
      } catch {
        /* noop */
      } finally {
        if (alive) setLoadingBalance(false);
      }
    };

    fetchBalance();
    return () => {
      alive = false;
    };
  }, [authenticated, wallet?.address]);

  if (!ready || !authenticated) {
    return (
      <button
        onClick={login}
        disabled={!ready}
        className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-[var(--cb-accent)]/20 ${
          ready
            ? 'bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-primary)] cursor-pointer'
            : 'bg-[var(--cb-accent)]/60 text-[var(--cb-primary)] cursor-wait'
        }`}
      >
        {ready ? 'Connect Wallet' : 'Connect Wallet'}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--cb-success)]" />
          <span className="font-mono text-sm text-[var(--cb-text)]">
            {wallet?.address
              ? `${wallet.address.slice(0, 4)}...${wallet.address.slice(-4)}`
              : '—'}
          </span>
        </div>

        <div className="h-4 w-px bg-[var(--cb-border)]" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--cb-text-muted)]">USDC</span>
          {loadingBalance ? (
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          ) : (
            <span className="text-sm font-bold text-[var(--cb-success)]">
              {usdcBalance !== null ? `$${usdcBalance.toFixed(2)}` : '—'}
            </span>
          )}
        </div>

        {process.env.NEXT_PUBLIC_SOLANA_NETWORK !== 'mainnet-beta' && (
          <>
            <div className="h-4 w-px bg-[var(--cb-border)]" />
            <a
              href="https://spl-token-faucet.com/?token-name=USDC-Dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[var(--cb-accent)] hover:underline"
              title="Get devnet USDC"
            >
              Faucet
            </a>
          </>
        )}
      </div>

      <button
        onClick={logout}
        className="px-3 py-2 rounded-lg border border-[var(--cb-border)] text-sm text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--cb-surface-hover)] transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}

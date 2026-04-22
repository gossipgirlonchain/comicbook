'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { useState, useEffect } from 'react';

export default function PrivyConnect({
  hideLogin = false,
}: {
  hideLogin?: boolean;
} = {}) {
  const { authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  useEffect(() => {
    if (!authenticated || !wallet?.address) {
      setBalance(null);
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
          setBalance(data.balance ?? 0);
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

  if (!authenticated) {
    if (hideLogin) return null;
    return (
      <button
        onClick={login}
        className="px-6 py-2.5 rounded-xl bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] font-bold text-sm transition-colors shadow-lg shadow-[var(--cb-accent)]/20"
      >
        Sign In
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] px-4 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--cb-text-muted)] uppercase tracking-wider">Balance</span>
          {loadingBalance ? (
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          ) : (
            <span className="text-sm font-bold text-[var(--cb-success)]">
              {balance !== null ? `$${balance.toFixed(2)}` : '-'}
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
              title="Get test funds"
            >
              Test $
            </a>
          </>
        )}
      </div>

      <button
        onClick={logout}
        className="px-3 py-2 rounded-lg border border-[var(--cb-border)] text-sm text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--cb-surface-hover)] transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}

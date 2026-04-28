'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { Connection } from '@solana/web3.js';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import PrivyConnect from '@/app/components/PrivyConnect';
import { privyToCoinflowWallet } from '@/lib/privy-coinflow-wallet';
import type { WalletAdapter } from '@/lib/types';

// Coinflow's component pulls in browser-only deps (iframes, postMessage).
// Lazy-load on the client so it doesn't run in SSR.
const CoinflowPurchase = dynamic(
  () => import('@coinflowlabs/react').then((m) => m.CoinflowPurchase),
  { ssr: false }
);

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const MERCHANT_ID = process.env.NEXT_PUBLIC_COINFLOW_MERCHANT_ID || '';

const PRESETS = [25, 50, 100, 250];

type CoinflowSession = { sessionKey: string; env: 'sandbox' | 'prod' };

export default function DepositPage() {
  const { ready, authenticated, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [amount, setAmount] = React.useState<number>(50);
  const [session, setSession] = React.useState<CoinflowSession | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const startCheckout = async () => {
    if (!wallet?.address) return;
    setError(null);
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('Session expired. Please sign in again.');
        return;
      }
      const res = await fetch('/api/coinflow/sessionKey', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ wallet: wallet.address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Failed to start checkout');
        return;
      }
      setSession({ sessionKey: data.sessionKey, env: data.env });
    } catch (e) {
      console.error('[deposit] start checkout failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to start checkout');
    } finally {
      setLoading(false);
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
                Top up your balance to pull the machine.
              </p>
            </div>

            <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--cb-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-[var(--cb-accent)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
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

              <div>
                <label className="block text-[10px] font-semibold text-[var(--cb-text-muted)] uppercase tracking-wider mb-2">
                  Amount
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map((value) => (
                    <button
                      key={value}
                      onClick={() => setAmount(value)}
                      className={`rounded-lg border px-2 py-3 text-center transition-all ${
                        amount === value
                          ? 'border-[var(--cb-accent)] bg-[var(--cb-accent)]/10 text-[var(--cb-accent)]'
                          : 'border-[var(--cb-border)] text-[var(--cb-text-muted)] hover:bg-[var(--cb-surface-hover)]'
                      }`}
                    >
                      <span className="text-base font-bold">${value}</span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={startCheckout}
                disabled={loading || amount <= 0}
                className="w-full py-3 rounded-xl bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] font-bold text-sm transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span
                      className="spinner"
                      style={{ width: 16, height: 16, borderWidth: 2 }}
                    />
                    Opening checkout...
                  </span>
                ) : (
                  `Add $${amount}`
                )}
              </button>

              {error && (
                <p className="text-xs text-[var(--cb-error)] text-center">
                  {error}
                </p>
              )}

              <p className="text-[10px] text-[var(--cb-text-muted)] text-center">
                USDC arrives in your wallet in seconds.
              </p>
            </div>

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

      {session && wallet && (
        <CoinflowModal
          session={session}
          wallet={wallet as unknown as WalletAdapter}
          amountUsd={amount}
          email={user?.email?.address ?? undefined}
          onClose={() => setSession(null)}
        />
      )}
    </div>
  );
}

function CoinflowModal({
  session,
  wallet,
  amountUsd,
  email,
  onClose,
}: {
  session: CoinflowSession;
  wallet: WalletAdapter;
  amountUsd: number;
  email?: string;
  onClose: () => void;
}) {
  // One Connection per modal mount. Using useMemo so the iframe doesn't
  // remount on every parent rerender.
  const connection = React.useMemo(
    () => new Connection(RPC_URL, 'confirmed'),
    []
  );
  const coinflowWallet = React.useMemo(
    () => privyToCoinflowWallet(wallet, connection),
    [wallet, connection]
  );

  if (!MERCHANT_ID) {
    return (
      <Overlay onClose={onClose}>
        <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-6 max-w-sm w-full space-y-3">
          <h3 className="text-base font-bold">Card payments not configured</h3>
          <p className="text-sm text-[var(--cb-text-muted)]">
            NEXT_PUBLIC_COINFLOW_MERCHANT_ID is not set. Configure Coinflow in
            your environment to enable this flow.
          </p>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-lg border border-[var(--cb-border)] text-sm font-semibold"
          >
            Close
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <div className="rounded-2xl bg-[var(--cb-surface)] border border-[var(--cb-border)] w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--cb-border)]">
          <h3 className="text-sm font-bold">Add ${amountUsd}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--cb-surface-hover)]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <CoinflowPurchase
            sessionKey={session.sessionKey}
            merchantId={MERCHANT_ID}
            env={session.env}
            connection={connection}
            wallet={coinflowWallet}
            blockchain="solana"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            settlementType={'USDC' as any}
            subtotal={{
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              currency: 'USD' as any,
              cents: Math.round(amountUsd * 100),
            }}
            email={email}
            onSuccess={(args) => {
              console.log('[coinflow] purchase success', args);
              onClose();
            }}
          />
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">
        {children}
      </div>
    </div>
  );
}

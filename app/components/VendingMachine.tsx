'use client';

import * as React from 'react';
import { useWallets } from '@privy-io/react-auth/solana';
import { usePrivy } from '@privy-io/react-auth';
import { gachaApi, ApiError } from '@/lib/api';
import { signTransaction, getNftImageUrl } from '@/lib/solana';
import type {
  GachaStatus,
  PackType,
  OpenPackResult,
  WalletAdapter,
  Winner,
} from '@/lib/types';
import { PACK_CONFIG, RARITY_COLORS } from '@/lib/types';

type PurchasePhase =
  | 'idle'
  | 'generating'
  | 'signing'
  | 'submitting'
  | 'opening'
  | 'done'
  | 'error';

type Props = {
  onResult: (results: OpenPackResult[], turbo: boolean) => void;
};

export default function VendingMachine({ onResult }: Props) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [status, setStatus] = React.useState<GachaStatus | null>(null);
  const [selectedPack, setSelectedPack] = React.useState<PackType>('pokemon_50');
  const [yoloCount, setYoloCount] = React.useState(1);
  const [turboMode, setTurboMode] = React.useState(false);
  const [phase, setPhase] = React.useState<PurchasePhase>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [shaking, setShaking] = React.useState(false);
  const [winners, setWinners] = React.useState<Winner[]>([]);
  const [usdcBalance, setUsdcBalance] = React.useState<number | null>(null);

  const isYolo = yoloCount > 1;
  const isRunning = status?.machineStatus === 'running';
  const canPurchase =
    ready && authenticated && !!wallet && isRunning && phase === 'idle';

  React.useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await gachaApi.getStatus();
        if (alive) setStatus(s);
      } catch (e) { console.error('[VendingMachine] status poll failed:', e); }
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  React.useEffect(() => {
    if (!wallet?.address) { setUsdcBalance(null); return; }
    let alive = true;
    const fetchBal = async () => {
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
      } catch { /* noop */ }
    };
    fetchBal();
    const id = setInterval(fetchBal, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [wallet?.address]);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { winners: w } = await gachaApi.getAllWinners();
        if (alive) setWinners(w ?? []);
      } catch (e) { console.error('[VendingMachine] winners fetch failed:', e); }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  const handlePurchase = async () => {
    if (!wallet) return;
    if (usdcBalance !== null && usdcBalance < price) {
      setError(`Insufficient USDC balance. You need $${price} but have $${usdcBalance.toFixed(2)}.`);
      setPhase('error');
      return;
    }
    setError(null);
    triggerShake();
    const w = wallet as unknown as WalletAdapter;
    try {
      if (isYolo) await handleYoloPurchase(w);
      else await handleStandardPurchase(w);
    } catch (e) {
      setPhase('error');
      if (e instanceof ApiError) {
        if (e.status === 500) setError('Pack out of stock. Try again later.');
        else if (e.status === 403) setError('Not eligible for this pack type.');
        else setError(e.message);
      } else if (e instanceof Error) {
        if (e.message.includes('User rejected') || e.message.includes('cancelled'))
          setError('Transaction cancelled. You can try again.');
        else setError(e.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  };

  const handleStandardPurchase = async (w: WalletAdapter) => {
    setPhase('generating');
    const { transaction, memo } = await gachaApi.generatePack(w.address, selectedPack, turboMode || undefined);
    setPhase('signing');
    const signed = await signTransaction(transaction, w);
    setPhase('submitting');
    await gachaApi.submitTransaction(signed);
    setPhase('opening');
    const result = await gachaApi.openPack(memo);
    setPhase('done');
    onResult([result], turboMode);
    setTimeout(() => setPhase('idle'), 300);
  };

  const handleYoloPurchase = async (w: WalletAdapter) => {
    setPhase('generating');
    const { packs } = await gachaApi.generateYoloPacks(w.address, selectedPack, yoloCount);
    setPhase('signing');
    const signedTxs: string[] = [];
    for (const pack of packs) {
      const signed = await signTransaction(pack.transaction, w);
      signedTxs.push(signed);
    }
    setPhase('submitting');
    for (const signed of signedTxs) {
      await gachaApi.submitTransaction(signed);
    }
    setPhase('opening');
    const results: OpenPackResult[] = [];
    for (const pack of packs) {
      const result = await gachaApi.openPack(pack.memo);
      results.push(result);
    }
    setPhase('done');
    onResult(results, turboMode);
    setTimeout(() => setPhase('idle'), 300);
  };

  const dismissError = () => {
    setError(null);
    setPhase('idle');
  };

  const phaseLabel: Record<PurchasePhase, string> = {
    idle: '',
    generating: 'Generating pack...',
    signing: 'Sign in your wallet...',
    submitting: 'Submitting...',
    opening: 'Revealing...',
    done: 'Done!',
    error: 'Error',
  };

  const price = PACK_CONFIG[selectedPack].price * yoloCount;
  const cfg = PACK_CONFIG[selectedPack];

  return (
    <div className={`rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] overflow-hidden ${shaking ? 'machine-shake' : ''}`}>
      {/* Status indicator */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--cb-border)] bg-[var(--cb-primary)]/20">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${isRunning ? 'bg-[var(--cb-success)] pulse-dot' : status?.machineStatus === 'stopped' ? 'bg-[var(--cb-error)]' : 'bg-[var(--cb-warning)]'}`} />
          <span className="text-[11px] font-medium text-[var(--cb-text-muted)] uppercase tracking-wider">
            {isRunning ? 'Online' : status?.machineStatus === 'stopped' ? 'Maintenance' : status ? 'Offline' : 'Loading...'}
          </span>
        </div>
      </div>

      {/* Maintenance banner */}
      {status?.machineStatus === 'stopped' && (
        <div className="px-4 py-2.5 bg-[var(--cb-error)]/10 border-b border-[var(--cb-error)]/30 text-center">
          <p className="text-sm text-[var(--cb-error)] font-medium">
            {status.message || 'Machine is under maintenance. Check back soon.'}
          </p>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Pack type selector */}
        <div className="flex gap-2">
          {(Object.entries(PACK_CONFIG) as [PackType, typeof PACK_CONFIG[PackType]][]).map(
            ([type, c]) => {
              const active = selectedPack === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedPack(type)}
                  disabled={!isRunning}
                  className={`flex-1 rounded-lg border px-3 py-2 text-center transition-all text-sm font-semibold ${
                    active
                      ? 'border-[var(--cb-accent)] bg-[var(--cb-accent)]/10 text-[var(--cb-accent)]'
                      : 'border-[var(--cb-border)] text-[var(--cb-text-muted)] hover:bg-[var(--cb-surface-hover)]'
                  } disabled:opacity-40`}
                >
                  {c.slug === 'standard' ? 'STANDARD' : 'LEGENDARY'}
                </button>
              );
            }
          )}
        </div>

        {/* Pack info */}
        <div className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-bg)] p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] bg-[var(--cb-success)]/20 text-[var(--cb-success)] px-2 py-0.5 rounded-full font-bold uppercase">
              Guaranteed Authenticity
            </span>
          </div>
          <h3 className="text-base font-bold mt-2">
            {cfg.label}
          </h3>
          <p className="text-2xl font-bold text-[var(--cb-accent)] mt-1">
            ${cfg.price}.00
            <span className="text-xs font-normal text-[var(--cb-text-muted)] ml-1">USDC</span>
          </p>
        </div>

        {/* YOLO + Turbo row */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-semibold text-[var(--cb-text-muted)] mb-1.5 uppercase tracking-wider">
              Packs
            </label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setYoloCount((c) => Math.max(1, c - 1))}
                disabled={yoloCount <= 1}
                className="w-8 h-8 rounded-lg border border-[var(--cb-border)] bg-[var(--cb-bg)] text-[var(--cb-text)] text-sm font-bold hover:bg-[var(--cb-surface-hover)] disabled:opacity-30 transition-colors"
              >
                -
              </button>
              <span className="w-8 text-center font-bold tabular-nums">{yoloCount}</span>
              <button
                onClick={() => setYoloCount((c) => Math.min(10, c + 1))}
                disabled={yoloCount >= 10}
                className="w-8 h-8 rounded-lg border border-[var(--cb-border)] bg-[var(--cb-bg)] text-[var(--cb-text)] text-sm font-bold hover:bg-[var(--cb-surface-hover)] disabled:opacity-30 transition-colors"
              >
                +
              </button>
              {isYolo && (
                <span className="text-xs text-[var(--cb-text-muted)] ml-1">
                  = ${price} USDC
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[var(--cb-text-muted)] mb-1.5 uppercase tracking-wider">
              Turbo
            </label>
            <button
              onClick={() => setTurboMode((t) => !t)}
              className={`relative w-11 h-6 rounded-full transition-colors ${turboMode ? 'bg-[var(--cb-accent)]' : 'bg-[var(--cb-border)]'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${turboMode ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>

        {/* Purchase / Sign-in button */}
        <button
          onClick={authenticated ? handlePurchase : login}
          disabled={authenticated && !canPurchase}
          className={`w-full py-3.5 rounded-xl font-bold text-base transition-all ${
            !authenticated
              ? 'bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-primary)]'
              : canPurchase
                ? 'bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-primary)] shadow-lg shadow-[var(--cb-accent)]/25 active:scale-[0.98]'
                : 'bg-[var(--cb-border)] text-[var(--cb-text-muted)] cursor-not-allowed'
          }`}
        >
          {phase !== 'idle' && phase !== 'error' ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              {phaseLabel[phase]}
            </span>
          ) : !authenticated ? (
            'Sign In to Open'
          ) : (
            <>
              {isYolo ? `YOLO ${yoloCount} Packs - $${price}` : `Open Pack - $${price}`}
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-[var(--cb-error)]/30 bg-[var(--cb-error)]/10 p-3">
            <p className="text-sm text-[var(--cb-error)]">{error}</p>
            <button onClick={dismissError} className="mt-1 text-xs text-[var(--cb-text-muted)] underline hover:text-[var(--cb-text)]">
              Dismiss
            </button>
          </div>
        )}

        {/* Devnet faucet */}
        {process.env.NEXT_PUBLIC_SOLANA_NETWORK !== 'mainnet-beta' && (
          <div className="flex items-center gap-2 text-xs text-[var(--cb-text-muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--cb-warning)]" />
            <span>Devnet</span>
            <span className="text-[var(--cb-border)]">·</span>
            <a
              href="https://spl-token-faucet.com/?token-name=USDC-Dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--cb-accent)] hover:underline"
            >
              Get test USDC
            </a>
          </div>
        )}

        {/* Stats section */}
        <div className="border-t border-[var(--cb-border)] pt-4 space-y-3">
          <h4 className="text-[10px] font-semibold text-[var(--cb-text-muted)] uppercase tracking-wider">
            Pack contains
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Cards" value="1" />
            <StatBox label="Buyback" value="85%" />
            <StatBox label="Big Win" value="20%" />
          </div>
        </div>

        {/* Rarity odds */}
        <div className="border-t border-[var(--cb-border)] pt-4 space-y-2">
          <h4 className="text-[10px] font-semibold text-[var(--cb-text-muted)] uppercase tracking-wider">
            Statistics
          </h4>
          <div className="space-y-1.5">
            <OddsRow color="var(--rarity-epic)" label="Epic" range="$250+" chance="1%" />
            <OddsRow color="var(--rarity-rare)" label="Rare" range="$110 - $250" chance="4%" />
            <OddsRow color="var(--rarity-uncommon)" label="Uncommon" range="$60 - $110" chance="15%" />
            <OddsRow color="var(--rarity-common)" label="Common" range="$30 - $60" chance="80%" />
          </div>
        </div>

        {/* Recent winners */}
        <div className="border-t border-[var(--cb-border)] pt-4">
          <h4 className="text-[10px] font-semibold text-[var(--cb-text-muted)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--cb-success)] pulse-dot" />
            Recent Openings
          </h4>
          {winners.length === 0 ? (
            <p className="text-xs text-[var(--cb-text-muted)]">Loading recent winners...</p>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {winners.slice(0, 15).map((winner, i) => {
                const isHighlight = winner.rarity === 'Epic' || winner.rarity === 'Legendary';
                const colors = RARITY_COLORS[winner.rarity] || RARITY_COLORS.Common;
                return (
                  <div
                    key={`${winner.transactionSignature}-${i}`}
                    className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
                      isHighlight ? 'bg-[var(--cb-accent)]/5 border border-[var(--cb-accent)]/20' : 'hover:bg-[var(--cb-surface-hover)]'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-[var(--cb-bg)] flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getNftImageUrl(winner.nftWon)} alt="" className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{winner.nftWon.content.metadata.name}</p>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-bold px-1 py-px rounded ${colors.bg} ${colors.text}`}>
                          {winner.rarity}
                        </span>
                        <span className="text-[10px] text-[var(--cb-text-muted)]">
                          {winner.playerAddress.slice(0, 4)}...{winner.playerAddress.slice(-4)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--cb-border)] bg-[var(--cb-bg)] p-2.5 text-center">
      <div className="text-sm font-bold text-[var(--cb-text)]">{value}</div>
      <div className="text-[10px] text-[var(--cb-text-muted)] mt-0.5">{label}</div>
    </div>
  );
}

function OddsRow({ color, label, range, chance }: { color: string; label: string; range: string; chance: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="font-semibold text-[var(--cb-text)] w-20">{label}</span>
      <span className="text-[var(--cb-text-muted)] flex-1">{range}</span>
      <span className="font-bold text-[var(--cb-text)]">{chance}</span>
    </div>
  );
}

'use client';

import * as React from 'react';
import { useWallets } from '@privy-io/react-auth/solana';
import { usePrivy } from '@privy-io/react-auth';
import { gachaApi, ApiError } from '@/lib/api';
import { signTransaction } from '@/lib/solana';
import type {
  GachaStatus,
  PackType,
  OpenPackResult,
  WalletAdapter,
} from '@/lib/types';
import { PACK_CONFIG } from '@/lib/types';

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
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [status, setStatus] = React.useState<GachaStatus | null>(null);
  const [selectedPack, setSelectedPack] = React.useState<PackType>('pokemon_50');
  const [yoloCount, setYoloCount] = React.useState(1);
  const [turboMode, setTurboMode] = React.useState(false);
  const [phase, setPhase] = React.useState<PurchasePhase>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [shaking, setShaking] = React.useState(false);

  const isYolo = yoloCount > 1;
  const isRunning = status?.status === 'running';
  const canPurchase =
    ready && authenticated && !!wallet && isRunning && phase === 'idle';

  React.useEffect(() => {
    let alive = true;

    const poll = async () => {
      try {
        const s = await gachaApi.getStatus();
        if (alive) setStatus(s);
      } catch {
        /* status endpoint may not exist yet */
      }
    };

    poll();
    const id = setInterval(poll, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  };

  const handlePurchase = async () => {
    if (!wallet) return;
    setError(null);
    triggerShake();

    const w = wallet as unknown as WalletAdapter;

    try {
      if (isYolo) {
        await handleYoloPurchase(w);
      } else {
        await handleStandardPurchase(w);
      }
    } catch (e) {
      setPhase('error');
      if (e instanceof ApiError) {
        if (e.status === 500) setError('Pack out of stock. Try again later.');
        else if (e.status === 403)
          setError('Not eligible for this pack type.');
        else setError(e.message);
      } else if (e instanceof Error) {
        if (e.message.includes('User rejected') || e.message.includes('cancelled')) {
          setError('Transaction cancelled. You can try again.');
        } else {
          setError(e.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    }
  };

  const handleStandardPurchase = async (w: WalletAdapter) => {
    setPhase('generating');
    const { transaction, memo } = await gachaApi.generatePack(
      w.address,
      selectedPack,
      turboMode || undefined
    );

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
    const { packs } = await gachaApi.generateYoloPacks(
      w.address,
      selectedPack,
      yoloCount
    );

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
    submitting: 'Submitting transaction...',
    opening: 'Revealing your card...',
    done: 'Done!',
    error: 'Error',
  };

  const price = PACK_CONFIG[selectedPack].price * yoloCount;

  return (
    <div
      className={`relative rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] overflow-hidden ${shaking ? 'machine-shake' : ''}`}
    >
      {/* Status bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--cb-border)] bg-[var(--cb-primary)]/30">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${isRunning ? 'bg-[var(--cb-success)] pulse-dot' : status?.status === 'stopped' ? 'bg-[var(--cb-error)]' : 'bg-[var(--cb-warning)]'}`}
          />
          <span className="text-xs font-medium text-[var(--cb-text-muted)] uppercase tracking-wider">
            {isRunning ? 'Online' : status?.status === 'stopped' ? 'Maintenance' : 'Loading...'}
          </span>
        </div>
        <span className="text-xs text-[var(--cb-text-muted)] font-mono">
          vending.comicbook.com
        </span>
      </div>

      {/* Maintenance banner */}
      {status?.status === 'stopped' && (
        <div className="px-5 py-3 bg-[var(--cb-error)]/10 border-b border-[var(--cb-error)]/30 text-center">
          <p className="text-sm text-[var(--cb-error)] font-medium">
            Machine is under maintenance. {status.message || 'Check back soon.'}
          </p>
        </div>
      )}

      <div className="p-6 space-y-6">
        {/* Pack selection */}
        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(PACK_CONFIG) as [PackType, typeof PACK_CONFIG[PackType]][]).map(
            ([type, cfg]) => {
              const isSelected = selectedPack === type;
              const isLegendary = type === 'pokemon_250';
              return (
                <button
                  key={type}
                  onClick={() => setSelectedPack(type)}
                  disabled={!isRunning}
                  className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                    isSelected
                      ? isLegendary
                        ? 'border-[var(--rarity-legendary)] bg-[var(--rarity-legendary)]/8'
                        : 'border-[var(--cb-accent)] bg-[var(--cb-accent)]/8'
                      : 'border-[var(--cb-border)] hover:border-[var(--cb-border)] hover:bg-[var(--cb-surface-hover)]'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <div className="text-sm font-semibold text-[var(--cb-text)]">
                    {cfg.label}
                  </div>
                  <div className={`mt-1 text-2xl font-bold ${isLegendary ? 'text-[var(--rarity-legendary)]' : 'text-[var(--cb-accent)]'}`}>
                    ${cfg.price}
                  </div>
                  <div className="mt-1 text-xs text-[var(--cb-text-muted)]">
                    USDC per pack
                  </div>
                  {isSelected && (
                    <div className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center ${isLegendary ? 'bg-[var(--rarity-legendary)]' : 'bg-[var(--cb-accent)]'}`}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke={isLegendary ? '#1a1a1a' : '#1a1a1a'}
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              );
            }
          )}
        </div>

        {/* YOLO stepper + Turbo */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--cb-text-muted)] mb-2 uppercase tracking-wider">
              Quantity (YOLO mode)
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setYoloCount((c) => Math.max(1, c - 1))}
                disabled={yoloCount <= 1}
                className="w-9 h-9 rounded-lg border border-[var(--cb-border)] bg-[var(--cb-bg)] text-[var(--cb-text)] font-bold hover:bg-[var(--cb-surface-hover)] disabled:opacity-30 transition-colors"
              >
                -
              </button>
              <span className="w-10 text-center font-bold text-lg tabular-nums">
                {yoloCount}
              </span>
              <button
                onClick={() => setYoloCount((c) => Math.min(10, c + 1))}
                disabled={yoloCount >= 10}
                className="w-9 h-9 rounded-lg border border-[var(--cb-border)] bg-[var(--cb-bg)] text-[var(--cb-text)] font-bold hover:bg-[var(--cb-surface-hover)] disabled:opacity-30 transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-[var(--cb-text-muted)] mb-2 uppercase tracking-wider">
              Turbo mode
            </label>
            <button
              onClick={() => setTurboMode((t) => !t)}
              className={`relative w-12 h-7 rounded-full transition-colors ${turboMode ? 'bg-[var(--cb-accent)]' : 'bg-[var(--cb-border)]'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${turboMode ? 'translate-x-5' : ''}`}
              />
            </button>
            <p className="mt-1 text-xs text-[var(--cb-text-muted)]">
              Skip reveal animation
            </p>
          </div>
        </div>

        {/* Purchase button */}
        <button
          onClick={handlePurchase}
          disabled={!canPurchase}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            canPurchase
              ? 'bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-primary)] shadow-lg shadow-[var(--cb-accent)]/25 hover:shadow-[var(--cb-accent)]/40 active:scale-[0.98]'
              : 'bg-[var(--cb-border)] text-[var(--cb-text-muted)] cursor-not-allowed'
          }`}
        >
          {phase !== 'idle' && phase !== 'error' ? (
            <span className="flex items-center justify-center gap-3">
              <span className="spinner" />
              {phaseLabel[phase]}
            </span>
          ) : !authenticated ? (
            'Connect Wallet to Purchase'
          ) : (
            <>
              Pull the Lever — ${price} USDC
              {isYolo && (
                <span className="ml-2 text-sm font-normal opacity-80">
                  ({yoloCount} packs)
                </span>
              )}
            </>
          )}
        </button>

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-[var(--cb-error)]/30 bg-[var(--cb-error)]/10 p-4">
            <svg
              className="w-5 h-5 text-[var(--cb-error)] flex-shrink-0 mt-0.5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-[var(--cb-error)]">{error}</p>
              <button
                onClick={dismissError}
                className="mt-2 text-xs text-[var(--cb-text-muted)] underline hover:text-[var(--cb-text)]"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

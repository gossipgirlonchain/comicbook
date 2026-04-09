'use client';

import * as React from 'react';
import { useWallets } from '@privy-io/react-auth/solana';
import { gachaApi, ApiError } from '@/lib/api';
import { signTransaction, getNftImageUrl } from '@/lib/solana';
import type { OpenPackResult, WalletAdapter } from '@/lib/types';
import { RARITY_COLORS } from '@/lib/types';

type Props = {
  results: OpenPackResult[];
  turbo?: boolean;
  onClose: () => void;
  onBuybackComplete?: () => void;
};

export default function PackReveal({
  results,
  turbo,
  onClose,
  onBuybackComplete,
}: Props) {
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const isMulti = results.length > 1;
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [flipped, setFlipped] = React.useState(turbo ?? false);
  const [showSummary, setShowSummary] = React.useState(
    turbo && isMulti ? true : false
  );
  const [videoPhase, setVideoPhase] = React.useState<'playing' | 'done'>(
    turbo ? 'done' : 'playing'
  );
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (turbo || videoPhase !== 'done') return;
    const timer = setTimeout(() => setFlipped(true), 600);
    return () => clearTimeout(timer);
  }, [currentIdx, turbo, videoPhase]);

  const advanceOrSummary = () => {
    if (isMulti && currentIdx < results.length - 1) {
      setFlipped(false);
      setCurrentIdx((i) => i + 1);
    } else if (isMulti) {
      setShowSummary(true);
    } else {
      onClose();
    }
  };

  const current = results[currentIdx];
  if (!current) return null;

  const rarity = current.rarity;
  const colors = RARITY_COLORS[rarity] || RARITY_COLORS.Common;

  if (showSummary) {
    return (
      <SummaryGrid
        results={results}
        wallet={wallet as unknown as WalletAdapter}
        onClose={onClose}
        onBuybackComplete={onBuybackComplete}
      />
    );
  }

  if (videoPhase === 'playing') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overlay-enter"
        style={{ background: 'rgba(8, 13, 26, 0.97)' }}
        onClick={() => setVideoPhase('done')}
      >
        <video
          ref={videoRef}
          src="/gacha-video.webm"
          autoPlay
          muted
          playsInline
          onEnded={() => setVideoPhase('done')}
          className="max-w-2xl w-full rounded-2xl"
        />
        <button
          onClick={(e) => { e.stopPropagation(); setVideoPhase('done'); }}
          className="absolute top-6 right-6 text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] text-sm"
        >
          Skip &rarr;
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overlay-enter"
      style={{ background: 'rgba(8, 13, 26, 0.92)' }}
    >
      <div className="relative max-w-lg w-full mx-4 reveal-enter">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-[var(--cb-surface)] border border-[var(--cb-border)] text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] flex items-center justify-center text-lg"
        >
          &times;
        </button>

        {isMulti && !showSummary && (
          <div className="text-center mb-4">
            <span className="text-sm text-[var(--cb-text-muted)]">
              Card {currentIdx + 1} of {results.length}
            </span>
            <div className="flex gap-1 justify-center mt-2">
              {results.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all ${
                    i <= currentIdx
                      ? 'w-6 bg-[var(--cb-accent)]'
                      : 'w-3 bg-[var(--cb-border)]'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="card-flip-container w-full" style={{ height: 520 }}>
          <div
            className={`card-flip-inner w-full h-full ${flipped ? 'flipped' : ''}`}
          >
            {/* Card back */}
            <div className="card-flip-front bg-gradient-to-br from-[var(--cb-primary)] to-[#0f1a38] border-2 border-[var(--cb-border)] flex items-center justify-center">
              <div className="text-center space-y-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/cb-bug-yellow.png"
                  alt=""
                  className="w-16 h-16 mx-auto opacity-60"
                />
                <p className="text-[var(--cb-text-muted)] text-sm font-medium">
                  Tap to reveal
                </p>
              </div>
            </div>

            {/* Revealed card */}
            <div
              className={`card-flip-back border-2 ${colors.border} overflow-hidden rarity-glow`}
              style={{
                '--glow-color': `var(--rarity-${rarity.toLowerCase()})`,
              } as React.CSSProperties}
            >
              <div className="h-full flex flex-col bg-[var(--cb-surface)]">
                <div className="relative flex-1 min-h-0 bg-gradient-to-b from-[var(--cb-bg)] to-[var(--cb-surface)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getNftImageUrl(current.nftWon)}
                    alt={current.nftWon.content.metadata.name}
                    className="w-full h-full object-contain p-4"
                  />
                  {rarity === 'Legendary' && (
                    <div className="absolute inset-0 legendary-shimmer pointer-events-none" />
                  )}
                </div>

                <div className="p-4 space-y-3 border-t border-[var(--cb-border)]">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg leading-tight">
                      {current.nftWon.content.metadata.name}
                    </h3>
                    <span
                      className={`flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}
                    >
                      {rarity}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <ValuePill
                      label="Value"
                      value={getInsuredValue(current)}
                      color="text-[var(--cb-success)]"
                    />
                    <ValuePill
                      label="Grade"
                      value={getGrade(current)}
                      color="text-[var(--cb-accent)]"
                    />
                    <ValuePill
                      label="Points"
                      value={String(current.points)}
                      color="text-[var(--rarity-legendary)]"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <BuybackButton
                      result={current}
                      wallet={wallet as unknown as WalletAdapter}
                      onComplete={onBuybackComplete}
                    />
                    <button
                      onClick={advanceOrSummary}
                      className="flex-1 py-2.5 rounded-lg bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] font-semibold text-sm transition-colors"
                    >
                      {isMulti && currentIdx < results.length - 1
                        ? 'Next Card'
                        : isMulti
                          ? 'View Summary'
                          : 'Keep It'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValuePill({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div>
      <span className="text-[var(--cb-text-muted)] text-xs">{label}</span>
      <div className={`font-bold ${color}`}>{value}</div>
    </div>
  );
}

function BuybackButton({
  result,
  wallet,
  onComplete,
}: {
  result: OpenPackResult;
  wallet: WalletAdapter | undefined;
  onComplete?: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const sellPrice = (() => {
    const attr = result.nftWon.content.metadata.attributes.find(
      (a) => a.trait_type === 'Insured Value'
    );
    const v = attr ? parseFloat(attr.value) : 0;
    return (v * 0.85).toFixed(2);
  })();

  const handleBuyback = async () => {
    if (!wallet) return;
    setBusy(true);
    setError(null);

    try {
      const { serializedTransaction, memo } = await gachaApi.buyback(
        wallet.address,
        result.nft_address
      );

      const signed = await signTransaction(serializedTransaction, wallet);
      await gachaApi.submitTransaction(signed);

      if (memo) {
        await gachaApi.pollBuybackCheck(memo);
      }

      setDone(true);
      onComplete?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setError('Buyback window expired (24h).');
      } else {
        setError(e instanceof Error ? e.message : 'Buyback failed');
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="flex-1 py-2.5 rounded-lg bg-[var(--cb-success)]/20 text-[var(--cb-success)] text-center text-sm font-semibold">
        Sold!
      </div>
    );
  }

  return (
    <div className="flex-1">
      <button
        onClick={handleBuyback}
        disabled={busy || !wallet}
        className="w-full py-2.5 rounded-lg border border-[var(--cb-accent)]/40 text-[var(--cb-accent)] font-semibold text-sm hover:bg-[var(--cb-accent)]/10 disabled:opacity-40 transition-colors"
      >
        {busy ? 'Selling...' : `Sell $${sellPrice}`}
      </button>
      {error && (
        <p className="text-xs text-[var(--cb-error)] mt-1">{error}</p>
      )}
    </div>
  );
}

function SummaryGrid({
  results,
  wallet,
  onClose,
  onBuybackComplete,
}: {
  results: OpenPackResult[];
  wallet: WalletAdapter | undefined;
  onClose: () => void;
  onBuybackComplete?: () => void;
}) {
  const totalPoints = results.reduce((s, r) => s + r.points, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overlay-enter overflow-y-auto"
      style={{ background: 'rgba(8, 13, 26, 0.92)' }}
    >
      <div className="relative max-w-4xl w-full mx-4 my-8 bg-[var(--cb-surface)] rounded-2xl border border-[var(--cb-border)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--cb-border)] bg-[var(--cb-primary)]/20">
          <div>
            <h2 className="text-xl font-bold">YOLO Results</h2>
            <p className="text-sm text-[var(--cb-text-muted)]">
              {results.length} packs opened &middot; {totalPoints} total points
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-[var(--cb-border)] text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-6">
          {results.map((result, i) => {
            const r = result.rarity;
            const c = RARITY_COLORS[r] || RARITY_COLORS.Common;
            return (
              <div
                key={result.nft_address || i}
                className={`rounded-xl border ${c.border} bg-[var(--cb-bg)] overflow-hidden slide-up`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getNftImageUrl(result.nftWon)}
                  alt={result.nftWon.content.metadata.name}
                  className="w-full aspect-square object-contain p-2"
                />
                <div className="p-2 space-y-1">
                  <p className="text-xs font-semibold truncate">
                    {result.nftWon.content.metadata.name}
                  </p>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}
                    >
                      {r}
                    </span>
                    <span className="text-[10px] text-[var(--cb-success)] font-bold">
                      {getInsuredValue(result)}
                    </span>
                  </div>
                  <BuybackButton
                    result={result}
                    wallet={wallet}
                    onComplete={onBuybackComplete}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function getInsuredValue(result: OpenPackResult): string {
  const attr = result.nftWon.content.metadata.attributes.find(
    (a) => a.trait_type === 'Insured Value'
  );
  return attr ? `$${attr.value}` : 'N/A';
}

function getGrade(result: OpenPackResult): string {
  const attr = result.nftWon.content.metadata.attributes.find(
    (a) => a.trait_type === 'The Grade'
  );
  return attr?.value || 'N/A';
}

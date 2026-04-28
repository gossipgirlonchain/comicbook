'use client';

import * as React from 'react';
import { useWallets } from '@privy-io/react-auth/solana';
import { getNftImageUrl } from '@/lib/solana';
import type { OpenPackResult, WalletAdapter, Rarity } from '@/lib/types';
import { RARITY_COLORS, insuredValueToRarity } from '@/lib/types';
import BuybackAction, {
  getInsuredValueFromAttrs,
} from '@/app/components/BuybackAction';

type Props = {
  results: OpenPackResult[];
  onClose: () => void;
  onBuybackComplete?: () => void;
};

// CC's OpenPackResult.rarity returns the printed TCG rarity (e.g. "Uncommon"
// for a Mew Gold Star). Our app's rarity is a value-bucket tier matching the
// odds table on the vending machine. Always derive ours from insuredValue
// so the badge in the reveal matches what the inventory / collection shows.
function rarityFor(result: OpenPackResult): Rarity {
  const insured = getInsuredValueFromAttrs(
    result.nftWon.content.metadata.attributes
  );
  if (insured > 0) return insuredValueToRarity(insured);
  // Fall back to whatever CC sent if we don't have an Insured Value attr —
  // better than defaulting to Common when we genuinely don't know.
  return result.rarity ?? 'Common';
}

export default function PackReveal({
  results,
  onClose,
  onBuybackComplete,
}: Props) {
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const isMulti = results.length > 1;
  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [flipped, setFlipped] = React.useState(false);
  const [showSummary, setShowSummary] = React.useState(false);
  const [videoPhase, setVideoPhase] = React.useState<'playing' | 'done'>('playing');
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (videoPhase !== 'done') return;
    const timer = setTimeout(() => setFlipped(true), 600);
    return () => clearTimeout(timer);
  }, [currentIdx, videoPhase]);

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

  const rarity = rarityFor(current);
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
          src="/gacha-video.mp4"
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

  const insuredValue = getInsuredValueFromAttrs(
    current.nftWon.content.metadata.attributes
  );

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
                      value={
                        insuredValue
                          ? `$${insuredValue.toFixed(2)}`
                          : 'N/A'
                      }
                      color="text-[var(--cb-success)]"
                    />
                    <ValuePill
                      label="Grade"
                      value={getGrade(current)}
                      color="text-[var(--cb-accent)]"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <BuybackAction
                      wallet={wallet as unknown as WalletAdapter}
                      nftAddress={current.nft_address}
                      cardName={current.nftWon.content.metadata.name}
                      cardImage={getNftImageUrl(current.nftWon)}
                      insuredValue={insuredValue}
                      onComplete={onBuybackComplete}
                      className="flex-1"
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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overlay-enter overflow-y-auto"
      style={{ background: 'rgba(8, 13, 26, 0.92)' }}
    >
      <div className="relative max-w-4xl w-full mx-4 my-8 bg-[var(--cb-surface)] rounded-2xl border border-[var(--cb-border)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--cb-border)] bg-[var(--cb-primary)]/20">
          <div>
            <h2 className="text-xl font-bold">Your Pulls</h2>
            <p className="text-sm text-[var(--cb-text-muted)]">
              {results.length} {results.length === 1 ? 'pull' : 'pulls'} —
              keep them, or sell back for 85% instantly.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-[var(--cb-border)] text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-6 max-h-[75vh] overflow-y-auto">
          {results.map((result, i) => {
            const r = rarityFor(result);
            const c = RARITY_COLORS[r] || RARITY_COLORS.Common;
            const insured = getInsuredValueFromAttrs(
              result.nftWon.content.metadata.attributes
            );
            return (
              <div
                key={result.nft_address || i}
                className={`rounded-xl border ${c.border} bg-[var(--cb-bg)] overflow-hidden slide-up flex flex-col`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getNftImageUrl(result.nftWon)}
                    alt={result.nftWon.content.metadata.name}
                    className="w-full aspect-square object-contain p-2"
                  />
                  <span
                    className={`absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.text}`}
                  >
                    {r}
                  </span>
                </div>
                <div className="p-3 space-y-2 border-t border-[var(--cb-border)]/50">
                  <p
                    className="text-xs font-semibold truncate"
                    title={result.nftWon.content.metadata.name}
                  >
                    {result.nftWon.content.metadata.name}
                  </p>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-[var(--cb-text-muted)]">Value</span>
                    <span className="text-sm font-bold text-[var(--cb-success)]">
                      {insured ? `$${insured.toFixed(2)}` : 'N/A'}
                    </span>
                  </div>
                  <BuybackAction
                    wallet={wallet}
                    nftAddress={result.nft_address}
                    cardName={result.nftWon.content.metadata.name}
                    cardImage={getNftImageUrl(result.nftWon)}
                    insuredValue={insured}
                    onComplete={onBuybackComplete}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-[var(--cb-border)] bg-[var(--cb-bg)]/40 flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--cb-text-muted)]">
            You can also sell back any time from your inventory.
          </p>
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-lg bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] text-sm font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function getGrade(result: OpenPackResult): string {
  const attr = result.nftWon.content.metadata.attributes.find(
    (a) => a.trait_type === 'The Grade'
  );
  return attr?.value || 'N/A';
}

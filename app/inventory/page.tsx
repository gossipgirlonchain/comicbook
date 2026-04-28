'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import PrivyConnect from '@/app/components/PrivyConnect';
import { getNftImageUrl } from '@/lib/solana';
import type { MachinePull, WalletAdapter } from '@/lib/types';
import { RARITY_COLORS } from '@/lib/types';
import { getSoldBackIds } from '@/lib/collection';
import BuybackAction from '@/app/components/BuybackAction';

const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
const EXPLORER_CLUSTER =
  NETWORK === 'mainnet-beta' ? '' : `?cluster=${NETWORK}`;

type PullStatus = 'revealed' | 'pending' | 'failed';

type EnrichedPull = MachinePull & { status: PullStatus };

function deriveStatus(p: MachinePull): PullStatus {
  if (p.hasError) return 'failed';
  if (p.card) return 'revealed';
  return 'pending';
}

export default function InventoryPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [tab, setTab] = React.useState<'collection' | 'pulls'>('collection');
  const [pulls, setPulls] = React.useState<EnrichedPull[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Sold-back set lives in localStorage; bump this to recompute after a sale.
  const [soldKey, setSoldKey] = React.useState(0);

  const reloadPulls = React.useCallback(async () => {
    if (!wallet?.address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/machinePulls?address=${encodeURIComponent(wallet.address)}`,
        { cache: 'no-store' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      const raw = (data.pulls ?? []) as MachinePull[];
      setPulls(raw.map((p) => ({ ...p, status: deriveStatus(p) })));
    } catch (e) {
      console.error('[inventory] load pulls failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [wallet?.address]);

  React.useEffect(() => {
    let alive = true;
    if (!wallet?.address) return;
    (async () => {
      if (alive) await reloadPulls();
    })();
    return () => {
      alive = false;
    };
  }, [wallet?.address, reloadPulls]);

  const sold = React.useMemo(() => {
    if (!wallet?.address) return new Set<string>();
    return getSoldBackIds(wallet.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address, soldKey]);

  // Collection only shows cards the user still owns. Sold cards are filtered
  // out using the localStorage flag set by BuybackAction.
  const revealed = pulls.filter(
    (p) => p.status === 'revealed' && p.card && !sold.has(p.card.id)
  );

  const onSold = React.useCallback(() => {
    setSoldKey((k) => k + 1);
  }, []);

  const tabs = [
    { id: 'collection' as const, label: `Collection${revealed.length ? ` (${revealed.length})` : ''}` },
    { id: 'pulls' as const, label: `Machine Pulls${pulls.length ? ` (${pulls.length})` : ''}` },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-8">
        {!ready ? (
          <div className="flex justify-center py-20">
            <div className="spinner spinner-lg" />
          </div>
        ) : !authenticated ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-[var(--cb-text-muted)]">
              Connect your wallet to view your inventory.
            </p>
            <PrivyConnect />
          </div>
        ) : (
          <>
            <div className="flex gap-1 mb-6 p-1 rounded-xl bg-[var(--cb-bg)] border border-[var(--cb-border)] w-fit">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-[var(--cb-accent)] text-[var(--cb-accent-text)] font-bold shadow-sm'
                      : 'text-[var(--cb-text-muted)] hover:text-[var(--cb-text)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'collection' && (
              <CollectionGrid
                loading={loading}
                error={error}
                pulls={revealed}
                wallet={wallet as unknown as WalletAdapter | undefined}
                onSold={onSold}
              />
            )}

            {tab === 'pulls' && (
              <PullsList loading={loading} error={error} pulls={pulls} />
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function CollectionGrid({
  loading,
  error,
  pulls,
  wallet,
  onSold,
}: {
  loading: boolean;
  error: string | null;
  pulls: EnrichedPull[];
  wallet: WalletAdapter | undefined;
  onSold: () => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square rounded-xl bg-[var(--cb-surface)] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--cb-error)]/30 bg-[var(--cb-error)]/10 p-4 text-sm text-[var(--cb-error)]">
        Could not load collection: {error}
      </div>
    );
  }

  if (pulls.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--cb-text-muted)]">
        <p className="text-lg font-semibold">No cards yet</p>
        <p className="text-sm mt-1">
          <Link href="/" className="text-[var(--cb-accent)] hover:underline">
            Pull the machine
          </Link>{' '}
          to start your collection.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {pulls.map((p) => (
        <CollectionCard
          key={p.memo}
          pull={p}
          wallet={wallet}
          onSold={onSold}
        />
      ))}
    </div>
  );
}

function CollectionCard({
  pull,
  wallet,
  onSold,
}: {
  pull: EnrichedPull;
  wallet: WalletAdapter | undefined;
  onSold: () => void;
}) {
  if (!pull.card) return null;
  const { card } = pull;
  const colors = card.rarity ? RARITY_COLORS[card.rarity] : null;
  const name = card.nftWon.content.metadata.name || card.id;
  const img = getNftImageUrl(card.nftWon);
  const insuredValue = card.insuredValue
    ? parseFloat(card.insuredValue) || 0
    : 0;

  return (
    <div
      className={`group rounded-xl border overflow-hidden transition-all hover:shadow-lg ${
        colors
          ? `${colors.border} hover:${colors.glow}`
          : 'border-[var(--cb-border)]'
      } bg-[var(--cb-surface)] flex flex-col`}
    >
      <Link href={`/cards/${card.id}`} className="block">
        <div className="aspect-square bg-[var(--cb-bg)] p-2">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img}
              alt={name}
              className="w-full h-full object-contain rounded-lg"
            />
          ) : (
            <div className="w-full h-full rounded-lg bg-[var(--cb-surface)]" />
          )}
        </div>
        <div className="px-2.5 pt-2.5">
          <p className="text-xs font-semibold truncate">{name}</p>
          <div className="flex items-center justify-between mt-1">
            {card.rarity && colors && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
              >
                {card.rarity}
              </span>
            )}
            {insuredValue > 0 && (
              <span className="text-[10px] font-bold text-[var(--cb-success)]">
                ${insuredValue.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </Link>
      <div className="px-2.5 pb-2.5 pt-2 mt-auto">
        {insuredValue > 0 ? (
          <BuybackAction
            wallet={wallet}
            nftAddress={card.id}
            cardName={name}
            cardImage={img}
            insuredValue={insuredValue}
            onComplete={onSold}
          />
        ) : (
          <div className="text-[10px] text-center text-[var(--cb-text-muted)] py-2">
            No insured value
          </div>
        )}
      </div>
    </div>
  );
}

function PullsList({
  loading,
  error,
  pulls,
}: {
  loading: boolean;
  error: string | null;
  pulls: EnrichedPull[];
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--cb-error)]/30 bg-[var(--cb-error)]/10 p-4 text-sm text-[var(--cb-error)]">
        Could not load machine pulls: {error}
      </div>
    );
  }

  if (pulls.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--cb-text-muted)]">
        <p className="text-lg font-semibold">No machine pulls yet</p>
        <p className="text-sm mt-1">
          <Link href="/" className="text-[var(--cb-accent)] hover:underline">
            Pull the machine
          </Link>{' '}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pulls.map((p) => (
        <PullRow key={p.memo} pull={p} />
      ))}
    </div>
  );
}

function PullRow({ pull }: { pull: EnrichedPull }) {
  const date = pull.firstBlockTime
    ? new Date(pull.firstBlockTime * 1000)
    : null;
  const explorerUrl = `https://explorer.solana.com/tx/${pull.firstSignature}${EXPLORER_CLUSTER}`;

  const statusChip = (() => {
    if (pull.status === 'revealed') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--cb-success)]/20 text-[var(--cb-success)] font-semibold">
          Revealed
        </span>
      );
    }
    if (pull.status === 'failed') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--cb-error)]/20 text-[var(--cb-error)] font-semibold">
          On-chain failed
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--cb-warning)]/20 text-[var(--cb-warning)] font-semibold">
        Pending reveal
      </span>
    );
  })();

  const cardImg = pull.card ? getNftImageUrl(pull.card.nftWon) : null;
  const cardName =
    pull.card?.nftWon.content.metadata.name ?? 'Pull';

  const body = (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-3 hover:bg-[var(--cb-surface-hover)] transition-colors">
      {cardImg && (
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--cb-bg)] flex-shrink-0 p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cardImg}
            alt={cardName}
            className="w-full h-full object-contain"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">{cardName}</span>
          {statusChip}
          {pull.card?.insuredValue && (
            <span className="text-xs font-bold text-[var(--cb-success)]">
              ${pull.card.insuredValue}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--cb-text-muted)] mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{date ? date.toLocaleString() : 'Unknown time'}</span>
          <span className="text-[var(--cb-border)]">·</span>
          <span className="font-mono">
            {pull.memo.slice(0, 11)}…{pull.memo.slice(-4)}
          </span>
          <span className="text-[var(--cb-border)]">·</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--cb-accent)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View tx
          </a>
        </div>
      </div>
    </div>
  );

  if (pull.card) {
    return (
      <Link href={`/cards/${pull.card.id}`} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

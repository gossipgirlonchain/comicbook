'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import PrivyConnect from '@/app/components/PrivyConnect';
import { getNftImageUrl } from '@/lib/solana';
import type { MachinePull, NftWon } from '@/lib/types';
import { RARITY_COLORS, type Rarity } from '@/lib/types';

function getAttr(nft: NftWon, trait: string): string | null {
  return (
    nft.content.metadata.attributes.find((a) => a.trait_type === trait)
      ?.value || null
  );
}

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [pull, setPull] = React.useState<MachinePull | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!wallet?.address) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/machinePulls?address=${encodeURIComponent(wallet.address)}`,
          { cache: 'no-store' }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!alive) return;
        const found = (data.pulls as MachinePull[]).find(
          (p) => p.card?.id === id
        );
        setPull(found ?? null);
      } catch (e) {
        console.error('[card] load failed:', e);
        if (alive)
          setError(e instanceof Error ? e.message : 'Failed to load card');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, wallet?.address]);

  if (!ready) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="spinner spinner-lg" />
        </main>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-[var(--cb-text-muted)]">
            Sign in to view your card.
          </p>
          <PrivyConnect />
        </main>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="spinner spinner-lg" />
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-[var(--cb-error)] text-sm">{error}</p>
          <Link
            href="/inventory"
            className="text-[var(--cb-accent)] hover:underline text-sm"
          >
            Back to Inventory
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  if (!pull || !pull.card) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-lg font-semibold text-[var(--cb-text-muted)]">
            Card not found
          </p>
          <p className="text-sm text-[var(--cb-text-muted)] max-w-md">
            This card isn&apos;t in your collection, or it hasn&apos;t revealed
            yet.
          </p>
          <Link
            href="/inventory"
            className="text-[var(--cb-accent)] hover:underline text-sm"
          >
            Back to Inventory
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const { card } = pull;
  const nft = card.nftWon;
  const name = nft.content.metadata.name || card.id;
  const description = nft.content.metadata.description || null;
  const img = getNftImageUrl(nft);
  const rarity = card.rarity;
  const grade = getAttr(nft, 'The Grade');
  const insuredValue = card.insuredValue ?? getAttr(nft, 'Insured Value');
  const colors =
    rarity && rarity in RARITY_COLORS ? RARITY_COLORS[rarity] : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1100px] mx-auto w-full px-4 py-6">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] mb-6 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back
        </Link>

        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          <div
            className={`rounded-2xl border overflow-hidden bg-[var(--cb-bg)] p-4 ${
              colors ? colors.border : 'border-[var(--cb-border)]'
            }`}
          >
            <div className="aspect-[3/4] relative">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img}
                  alt={name}
                  className="w-full h-full object-contain rounded-xl"
                />
              ) : (
                <div className="w-full h-full rounded-xl bg-[var(--cb-surface)]" />
              )}
              {rarity === 'Legendary' && (
                <div className="absolute inset-0 legendary-shimmer pointer-events-none rounded-xl" />
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold break-words">{name}</h1>
              {description && (
                <p className="text-sm text-[var(--cb-text-muted)] mt-2">
                  {description}
                </p>
              )}
            </div>

            <div className="space-y-3">
              {rarity && colors && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--cb-border)]">
                  <span className="text-sm text-[var(--cb-text-muted)]">
                    Rarity
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}
                  >
                    {rarity}
                  </span>
                </div>
              )}
              {grade && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--cb-border)]">
                  <span className="text-sm text-[var(--cb-text-muted)]">
                    Grade
                  </span>
                  <span className="text-sm font-semibold">{grade}</span>
                </div>
              )}
              {insuredValue && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--cb-border)]">
                  <span className="text-sm text-[var(--cb-text-muted)]">
                    Value
                  </span>
                  <span className="text-sm font-bold text-[var(--cb-accent)]">
                    ${insuredValue}
                  </span>
                </div>
              )}
              {pull.firstBlockTime && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--cb-border)]">
                  <span className="text-sm text-[var(--cb-text-muted)]">
                    Pulled
                  </span>
                  <span className="text-sm font-semibold">
                    {new Date(pull.firstBlockTime * 1000).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-4">
              <p className="text-xs text-[var(--cb-text-muted)]">
                Cards can be sold back to the house for 85% of their insured
                value from your inventory or directly after opening a pack.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

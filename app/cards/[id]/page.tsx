'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { gachaApi } from '@/lib/api';
import { getNftImageUrl } from '@/lib/solana';
import type { NftWon } from '@/lib/types';
import { RARITY_COLORS, type Rarity } from '@/lib/types';

function getAttr(nft: NftWon, trait: string): string | null {
  return (
    nft.content.metadata.attributes.find((a) => a.trait_type === trait)
      ?.value || null
  );
}

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [nft, setNft] = React.useState<NftWon | null>(null);
  const [cardRarity, setCardRarity] = React.useState<Rarity | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // Cards in a user's collection live in the winners feed, not in the
        // getNfts pool (which returns CC's house inventory). Look up by
        // nft_address or NftWon.id.
        const { winners } = await gachaApi.getAllWinners();
        const win = (winners ?? []).find(
          (w) => (w.nft_address ?? w.nftWon.id) === id
        );
        if (alive) {
          if (win) {
            setNft(win.nftWon);
            setCardRarity(win.rarity);
          } else {
            setNotFound(true);
          }
        }
      } catch {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="spinner spinner-lg" />
        </main>
      </div>
    );
  }

  if (notFound || !nft) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-lg font-semibold text-[var(--cb-text-muted)]">
            Card not found
          </p>
          <Link
            href="/inventory"
            className="text-[var(--cb-accent)] hover:underline text-sm"
          >
            Back to Inventory
          </Link>
        </main>
      </div>
    );
  }

  const name = nft.content.metadata.name || nft.id;
  const description = nft.content.metadata.description || null;
  const img = getNftImageUrl(nft);
  const rarity = cardRarity ?? (getAttr(nft, 'Rarity') as Rarity | null);
  const grade = getAttr(nft, 'The Grade');
  const insuredValue = getAttr(nft, 'Insured Value');
  const colors = rarity && rarity in RARITY_COLORS ? RARITY_COLORS[rarity] : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1100px] mx-auto w-full px-4 py-6">
        {/* Back link */}
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

        {/* Card detail */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
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

          {/* Info */}
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">{name}</h1>
              {description && (
                <p className="text-sm text-[var(--cb-text-muted)] mt-2">
                  {description}
                </p>
              )}
            </div>

            {/* Attributes */}
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
            </div>

            {/* Info panel */}
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

'use client';

import * as React from 'react';
import Link from 'next/link';
import { gachaApi } from '@/lib/api';
import { getNftImageUrl } from '@/lib/solana';
import type { NftWon, Rarity } from '@/lib/types';
import { RARITY_COLORS } from '@/lib/types';
import { winnersToCollection, type OwnedCard } from '@/lib/collection';

/**
 * Card display shape. When `owner` is provided we derive this from the
 * winners feed (user's actual collection). When `owner` is not provided we
 * fall back to CC's full inventory pool for browsing-style use cases.
 */
type DisplayCard = {
  id: string;
  nftWon: NftWon;
  rarity: Rarity | null;
  insuredValue: string | null;
};

function readRarity(attrs: NftWon['content']['metadata']['attributes']): Rarity | null {
  const v = attrs.find((a) => a.trait_type === 'Rarity')?.value;
  if (v && v in RARITY_COLORS) return v as Rarity;
  return null;
}

function readInsuredValue(attrs: NftWon['content']['metadata']['attributes']): string | null {
  const v = attrs.find((a) => a.trait_type === 'Insured Value')?.value;
  return v ? `$${v}` : null;
}

function cardFromOwned(card: OwnedCard): DisplayCard {
  return {
    id: card.id,
    nftWon: card.nftWon,
    rarity: card.rarity,
    insuredValue: readInsuredValue(card.nftWon.content.metadata.attributes),
  };
}

export default function NftGallery({ owner }: { owner?: string }) {
  const [cards, setCards] = React.useState<DisplayCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (owner) {
          // Source: winners feed filtered by playerAddress.
          // CC's getNfts returns the house inventory pool — it never contains
          // anything owned by a user wallet — so we can't use it here.
          const { winners } = await gachaApi.getAllWinners();
          const collection = winnersToCollection(winners ?? [], owner);
          if (alive) setCards(collection.map(cardFromOwned));
        } else {
          // No owner → browsing mode, show the raw pool.
          const { nfts } = await gachaApi.getNfts();
          if (alive) {
            setCards(
              (nfts ?? []).map((n) => {
                const attrs = n.content?.metadata?.attributes ?? [];
                return {
                  id: n.id,
                  // The browse path doesn't wire rich metadata rendering the
                  // same way, so we cast defensively.
                  nftWon: n as unknown as NftWon,
                  rarity: readRarity(attrs),
                  insuredValue: readInsuredValue(attrs),
                };
              })
            );
          }
        }
      } catch (e) {
        if (alive)
          setError(e instanceof Error ? e.message : 'Failed to load NFTs');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [owner]);

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
      <div className="text-center py-8 text-[var(--cb-error)] text-sm">
        {error}
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="text-center py-12 text-[var(--cb-text-muted)]">
        <p className="text-lg font-semibold">No collectibles yet</p>
        <p className="text-sm mt-1">Pull the machine to start your collection.</p>
      </div>
    );
  }

  const shown = cards.slice(0, 100);

  return (
    <div>
      {cards.length > 100 && (
        <p className="text-xs text-[var(--cb-text-muted)] mb-3">
          Showing 100 of {cards.length}
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {shown.map((card, i) => {
          const name = card.nftWon.content.metadata.name || card.id;
          const img = getNftImageUrl(card.nftWon);
          const colors = card.rarity ? RARITY_COLORS[card.rarity] : null;

          return (
            <Link
              key={card.id || `nft-${i}`}
              href={`/cards/${card.id}`}
              className={`group rounded-xl border overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                colors
                  ? `${colors.border} hover:${colors.glow}`
                  : 'border-[var(--cb-border)]'
              } bg-[var(--cb-surface)]`}
            >
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
              <div className="p-2.5">
                <p className="text-xs font-semibold truncate">{name}</p>
                <div className="flex items-center justify-between mt-1">
                  {card.rarity && colors && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                    >
                      {card.rarity}
                    </span>
                  )}
                  {card.insuredValue && (
                    <span className="text-[10px] font-bold text-[var(--cb-success)]">
                      {card.insuredValue}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

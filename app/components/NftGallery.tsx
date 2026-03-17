'use client';

import * as React from 'react';
import { gachaApi } from '@/lib/api';
import { getNftImageUrl } from '@/lib/solana';
import type { Nft } from '@/lib/types';
import { RARITY_COLORS, type Rarity } from '@/lib/types';

function getPrice(nft: Nft) {
  const v = nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === 'Insured Value'
  )?.value;
  return v ? `$${v}` : null;
}

function getRarity(nft: Nft): Rarity | null {
  const v = nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === 'Rarity'
  )?.value;
  if (v && v in RARITY_COLORS) return v as Rarity;
  return null;
}

export default function NftGallery({ owner }: { owner?: string }) {
  const [nfts, setNfts] = React.useState<Nft[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { nfts: list } = await gachaApi.getNfts(owner);
        if (alive) setNfts(list ?? []);
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

  if (!nfts.length) {
    return (
      <div className="text-center py-12 text-[var(--cb-text-muted)]">
        <p className="text-lg font-semibold">No NFTs yet</p>
        <p className="text-sm mt-1">Open a pack to start your collection.</p>
      </div>
    );
  }

  const shown = nfts.slice(0, 100);

  return (
    <div>
      {nfts.length > 100 && (
        <p className="text-xs text-[var(--cb-text-muted)] mb-3">
          Showing 100 of {nfts.length}
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {shown.map((nft, i) => {
          const name = nft.content?.metadata?.name || nft.id;
          const img = getNftImageUrl(nft);
          const price = getPrice(nft);
          const rarity = getRarity(nft);
          const colors = rarity
            ? RARITY_COLORS[rarity]
            : null;

          return (
            <a
              key={nft.id || `nft-${i}`}
              href={`https://collectorcrypt.com/assets/solana/${nft.id}`}
              target="_blank"
              rel="noreferrer"
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
                  {rarity && colors && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                    >
                      {rarity}
                    </span>
                  )}
                  {price && (
                    <span className="text-[10px] font-bold text-[var(--cb-success)]">
                      {price}
                    </span>
                  )}
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

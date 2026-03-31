'use client';

import * as React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Link from 'next/link';
import Header from '@/app/components/Header';
import { gachaApi } from '@/lib/api';
import { getNftImageUrl } from '@/lib/solana';
import type { Nft } from '@/lib/types';
import { RARITY_COLORS, type Rarity } from '@/lib/types';

type SortOption = 'newest' | 'oldest' | 'price-high' | 'price-low' | 'name-az' | 'name-za';
type ViewMode = 'grid' | 'list';

function getRarity(nft: Nft): Rarity | null {
  const v = nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === 'Rarity'
  )?.value;
  if (v && v in RARITY_COLORS) return v as Rarity;
  return null;
}

function getInsuredValue(nft: Nft): number {
  const v = nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === 'Insured Value'
  )?.value;
  return v ? parseFloat(v) : 0;
}

function getGrade(nft: Nft): string | null {
  return nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === 'The Grade'
  )?.value || null;
}

export default function MarketplacePage() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [nfts, setNfts] = React.useState<Nft[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [sort, setSort] = React.useState<SortOption>('newest');
  const [viewMode, setViewMode] = React.useState<ViewMode>('grid');
  const [hideOwned, setHideOwned] = React.useState(false);
  const [rarityFilter, setRarityFilter] = React.useState<Rarity | 'all'>('all');

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { nfts: list } = await gachaApi.getNfts();
        if (alive) setNfts(list ?? []);
      } catch {
        /* */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = React.useMemo(() => {
    let result = [...nfts];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((nft) => {
        const name = (nft.content?.metadata?.name || '').toLowerCase();
        const desc = (nft.content?.metadata?.description || '').toLowerCase();
        return name.includes(q) || desc.includes(q) || nft.id.toLowerCase().includes(q);
      });
    }

    if (rarityFilter !== 'all') {
      result = result.filter((nft) => getRarity(nft) === rarityFilter);
    }

    if (hideOwned && wallet?.address) {
      result = result.filter((nft) => nft.ownership?.owner !== wallet.address);
    }

    switch (sort) {
      case 'price-high':
        result.sort((a, b) => getInsuredValue(b) - getInsuredValue(a));
        break;
      case 'price-low':
        result.sort((a, b) => getInsuredValue(a) - getInsuredValue(b));
        break;
      case 'name-az':
        result.sort((a, b) =>
          (a.content?.metadata?.name || '').localeCompare(b.content?.metadata?.name || '')
        );
        break;
      case 'name-za':
        result.sort((a, b) =>
          (b.content?.metadata?.name || '').localeCompare(a.content?.metadata?.name || '')
        );
        break;
      case 'oldest':
        result.reverse();
        break;
    }

    return result;
  }, [nfts, search, sort, rarityFilter, hideOwned, wallet?.address]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6">
        {/* Title row */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">
            MARKETPLACE: <span className="text-[var(--cb-accent)]">CARDS</span>
          </h1>
          <span className="text-sm text-[var(--cb-text-muted)]">
            Total cards: <span className="text-[var(--cb-accent)] font-bold">{nfts.length.toLocaleString()}</span>
          </span>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-3 rounded-xl bg-[var(--cb-surface)] border border-[var(--cb-border)]">
          {/* Rarity filter */}
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value as Rarity | 'all')}
            className="h-9 px-3 rounded-lg border border-[var(--cb-border)] bg-[var(--cb-bg)] text-[var(--cb-text)] text-sm focus:outline-none focus:border-[var(--cb-accent)]"
          >
            <option value="all">All Rarities</option>
            <option value="Common">Common</option>
            <option value="Uncommon">Uncommon</option>
            <option value="Rare">Rare</option>
            <option value="Epic">Epic</option>
            <option value="Legendary">Legendary</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search by Name, Address, or Card Name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-[var(--cb-border)] bg-[var(--cb-bg)] text-sm text-[var(--cb-text)] placeholder:text-[var(--cb-text-muted)] focus:outline-none focus:border-[var(--cb-accent)]"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--cb-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-9 px-3 rounded-lg border border-[var(--cb-border)] bg-[var(--cb-bg)] text-[var(--cb-text)] text-sm focus:outline-none focus:border-[var(--cb-accent)]"
          >
            <option value="newest">Newest to Oldest</option>
            <option value="oldest">Oldest to Newest</option>
            <option value="price-high">Price: High to Low</option>
            <option value="price-low">Price: Low to High</option>
            <option value="name-az">Name: A to Z</option>
            <option value="name-za">Name: Z to A</option>
          </select>

          {/* View mode */}
          <div className="flex rounded-lg border border-[var(--cb-border)] overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[var(--cb-accent)]/15 text-[var(--cb-accent)]' : 'bg-[var(--cb-bg)] text-[var(--cb-text-muted)] hover:text-[var(--cb-text)]'}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[var(--cb-accent)]/15 text-[var(--cb-accent)]' : 'bg-[var(--cb-bg)] text-[var(--cb-text-muted)] hover:text-[var(--cb-text)]'}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="14" height="3" rx="1" />
                <rect x="1" y="6" width="14" height="3" rx="1" />
                <rect x="1" y="11" width="14" height="3" rx="1" />
              </svg>
            </button>
          </div>

          {/* Hide owned */}
          {authenticated && (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--cb-text-muted)]">
              <button
                onClick={() => setHideOwned((h) => !h)}
                className={`relative w-9 h-5 rounded-full transition-colors ${hideOwned ? 'bg-[var(--cb-accent)]' : 'bg-[var(--cb-border)]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${hideOwned ? 'translate-x-4' : ''}`} />
              </button>
              Hide Owned
            </label>
          )}
        </div>

        {/* Card grid */}
        {loading ? (
          <div className={`grid gap-3 ${viewMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-1'}`}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className={`rounded-xl bg-[var(--cb-surface)] animate-pulse ${viewMode === 'grid' ? 'aspect-[3/4]' : 'h-20'}`} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-12 text-center">
            <p className="text-[var(--cb-text-muted)] text-lg font-semibold">No cards found</p>
            <p className="text-[var(--cb-text-muted)] text-sm mt-1">
              {search ? 'Try adjusting your search or filters.' : 'Cards will appear here once loaded.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.slice(0, 100).map((nft, i) => (
              <CardGridItem key={nft.id || `nft-${i}`} nft={nft} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.slice(0, 100).map((nft, i) => (
              <CardListItem key={nft.id || `nft-${i}`} nft={nft} />
            ))}
          </div>
        )}

        {filtered.length > 100 && (
          <p className="text-center text-sm text-[var(--cb-text-muted)] mt-6">
            Showing 100 of {filtered.length.toLocaleString()} cards
          </p>
        )}
      </main>

      <footer className="border-t border-[var(--cb-border)] bg-[var(--cb-surface)]/50 py-6 mt-auto">
        <div className="max-w-[1400px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--cb-text-muted)]">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cb-bug-yellow.png" alt="" className="w-5 h-5" />
            <span>&copy; {new Date().getFullYear()} ComicBook.com</span>
          </div>
          <span>Powered by CollectorCrypt</span>
        </div>
      </footer>
    </div>
  );
}

function CardGridItem({ nft }: { nft: Nft }) {
  const name = nft.content?.metadata?.name || nft.id;
  const img = getNftImageUrl(nft);
  const value = getInsuredValue(nft);
  const grade = getGrade(nft);
  const rarity = getRarity(nft);
  const colors = rarity ? RARITY_COLORS[rarity] : null;

  return (
    <Link
      href={`/marketplace/${nft.id}`}
      className={`group rounded-xl border overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg ${
        colors ? `${colors.border}` : 'border-[var(--cb-border)]'
      } bg-[var(--cb-surface)]`}
    >
      <div className="aspect-[3/4] bg-[var(--cb-bg)] p-2 relative">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={name} className="w-full h-full object-contain rounded-lg" />
        ) : (
          <div className="w-full h-full rounded-lg bg-[var(--cb-surface)]" />
        )}
        {rarity === 'Legendary' && (
          <div className="absolute inset-0 legendary-shimmer pointer-events-none rounded-lg" />
        )}
      </div>
      <div className="p-2.5 space-y-1.5">
        <p className="text-xs font-semibold truncate">{name}</p>
        <div className="flex items-center justify-between">
          {value > 0 && (
            <span className="text-xs font-bold text-[var(--cb-accent)]">${value}</span>
          )}
          {grade && (
            <span className="text-[10px] text-[var(--cb-text-muted)] font-medium">{grade}</span>
          )}
        </div>
        {rarity && colors && (
          <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
            {rarity}
          </span>
        )}
      </div>
    </Link>
  );
}

function CardListItem({ nft }: { nft: Nft }) {
  const name = nft.content?.metadata?.name || nft.id;
  const img = getNftImageUrl(nft);
  const value = getInsuredValue(nft);
  const grade = getGrade(nft);
  const rarity = getRarity(nft);
  const colors = rarity ? RARITY_COLORS[rarity] : null;

  return (
    <Link
      href={`/marketplace/${nft.id}`}
      className={`flex items-center gap-4 rounded-xl border p-3 transition-all hover:bg-[var(--cb-surface-hover)] ${
        colors ? `${colors.border}` : 'border-[var(--cb-border)]'
      } bg-[var(--cb-surface)]`}
    >
      <div className="w-14 h-14 rounded-lg overflow-hidden bg-[var(--cb-bg)] flex-shrink-0 p-1">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full rounded bg-[var(--cb-surface)]" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {rarity && colors && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {rarity}
            </span>
          )}
          {grade && (
            <span className="text-xs text-[var(--cb-text-muted)]">{grade}</span>
          )}
        </div>
      </div>
      {value > 0 && (
        <span className="text-sm font-bold text-[var(--cb-accent)]">${value}</span>
      )}
    </Link>
  );
}

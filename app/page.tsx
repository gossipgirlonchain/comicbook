'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import PrivyConnect from '@/app/components/PrivyConnect';
import VendingMachine from '@/app/components/VendingMachine';
import PackReveal from '@/app/components/PackReveal';
import { gachaApi } from '@/lib/api';
import { getNftImageUrl } from '@/lib/solana';
import type { OpenPackResult, Nft } from '@/lib/types';
import { RARITY_COLORS, type Rarity } from '@/lib/types';

function getRarity(nft: Nft): Rarity | null {
  const v = nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === 'Rarity'
  )?.value;
  if (v && v in RARITY_COLORS) return v as Rarity;
  return null;
}

function getInsuredValue(nft: Nft): string | null {
  const v = nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === 'Insured Value'
  )?.value;
  return v ? `$${v}` : null;
}

function getGrade(nft: Nft): string | null {
  return nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === 'The Grade'
  )?.value || null;
}

export default function Home() {
  const { authenticated } = usePrivy();
  const [revealResults, setRevealResults] = useState<OpenPackResult[] | null>(null);
  const [turboMode, setTurboMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedCards, setLoadedCards] = useState<Nft[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { nfts } = await gachaApi.getNfts();
        if (alive) setLoadedCards(nfts ?? []);
      } catch {
        /* non-critical */
      } finally {
        if (alive) setCardsLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [refreshKey]);

  const handleResult = (results: OpenPackResult[], turbo: boolean) => {
    setTurboMode(turbo);
    setRevealResults(results);
  };

  const closeReveal = () => {
    setRevealResults(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[var(--cb-border)] bg-[var(--cb-primary)] sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cb-logo-white.png" alt="ComicBook.com" className="h-7 w-auto" />
            <nav className="hidden md:flex items-center gap-4 text-sm">
              {authenticated && (
                <Link href="/inventory" className="text-white/60 hover:text-white transition-colors">
                  Inventory
                </Link>
              )}
            </nav>
          </div>
          <PrivyConnect />
        </div>
      </header>

      {/* Main content: card grid left, machine panel right */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT: Card grid */}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold mb-4 text-[var(--cb-text)]">
              Loaded in the Gacha Machine
            </h2>

            {cardsLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] rounded-xl bg-[var(--cb-surface)] animate-pulse" />
                ))}
              </div>
            ) : loadedCards.length === 0 ? (
              <div className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-8 text-center">
                <p className="text-[var(--cb-text-muted)]">The machine is loading...</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {loadedCards.slice(0, 40).map((nft, i) => {
                  const name = nft.content?.metadata?.name || nft.id;
                  const img = getNftImageUrl(nft);
                  const value = getInsuredValue(nft);
                  const grade = getGrade(nft);
                  const rarity = getRarity(nft);
                  const colors = rarity ? RARITY_COLORS[rarity] : null;

                  return (
                    <div
                      key={nft.id || `nft-${i}`}
                      className={`group rounded-xl border overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg ${
                        colors ? `${colors.border}` : 'border-[var(--cb-border)]'
                      } bg-[var(--cb-surface)]`}
                    >
                      <div className="aspect-[3/4] bg-[var(--cb-bg)] p-2 relative">
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
                        {rarity === 'Legendary' && (
                          <div className="absolute inset-0 legendary-shimmer pointer-events-none rounded-lg" />
                        )}
                      </div>
                      <div className="p-2.5 space-y-1">
                        <p className="text-xs font-semibold truncate">{name}</p>
                        <div className="flex items-center justify-between">
                          {value && (
                            <span className="text-xs font-bold text-[var(--cb-accent)]">{value}</span>
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Machine panel */}
          <div className="w-full lg:w-[380px] flex-shrink-0">
            <VendingMachine
              key={refreshKey}
              onResult={handleResult}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
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

      {/* Pack Reveal Overlay */}
      {revealResults && (
        <PackReveal
          results={revealResults}
          turbo={turboMode}
          onClose={closeReveal}
          onBuybackComplete={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

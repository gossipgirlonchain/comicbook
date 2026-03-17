'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import PrivyConnect from '@/app/components/PrivyConnect';
import VendingMachine from '@/app/components/VendingMachine';
import PackReveal from '@/app/components/PackReveal';
import WinnersFeed from '@/app/components/WinnersFeed';
import type { OpenPackResult } from '@/lib/types';

export default function Home() {
  const { authenticated } = usePrivy();
  const [revealResults, setRevealResults] = useState<OpenPackResult[] | null>(
    null
  );
  const [turboMode, setTurboMode] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
      <header className="border-b border-[var(--cb-border)] bg-[var(--cb-primary)]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cb-logo-white.png"
              alt="ComicBook.com"
              className="h-7 w-auto"
            />
            <span className="hidden sm:inline text-xs text-white/50 border-l border-white/20 pl-3 uppercase tracking-widest font-medium">
              Vending Machine
            </span>
          </div>

          <div className="flex items-center gap-4">
            {authenticated && (
              <Link
                href="/inventory"
                className="text-sm text-white/70 hover:text-white transition-colors"
              >
                Inventory
              </Link>
            )}
            <PrivyConnect />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Hero section */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <VendingMachine
              key={refreshKey}
              onResult={handleResult}
            />
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-6">
              <h2 className="text-sm font-semibold text-[var(--cb-accent)] uppercase tracking-wider mb-4">
                How It Works
              </h2>
              <ol className="space-y-3 text-sm">
                {[
                  ['Connect', 'Link your Solana wallet via email, Google, or browser extension.'],
                  ['Choose', 'Pick Standard ($50) or Legendary ($250) packs. Go YOLO for up to 10 at once.'],
                  ['Pull', 'Sign the transaction and watch your mystery card reveal.'],
                  ['Collect or Sell', 'Keep your NFT or sell it back instantly for USDC.'],
                ].map(([title, desc], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--cb-accent)]/15 text-[var(--cb-accent)] text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div>
                      <span className="font-semibold text-[var(--cb-text)]">{title}</span>
                      <span className="text-[var(--cb-text-muted)]"> — {desc}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-6">
              <h2 className="text-sm font-semibold text-[var(--cb-text-muted)] uppercase tracking-wider mb-2">
                Network
              </h2>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' ? 'bg-[var(--cb-success)]' : 'bg-[var(--cb-warning)]'}`} />
                <span className="text-sm">
                  {process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta'
                    ? 'Solana Mainnet'
                    : 'Solana Devnet'}
                </span>
              </div>
              {process.env.NEXT_PUBLIC_SOLANA_NETWORK !== 'mainnet-beta' && (
                <p className="text-xs text-[var(--cb-text-muted)] mt-2">
                  You&apos;re on devnet. Grab test USDC from the{' '}
                  <a
                    href="https://spl-token-faucet.com/?token-name=USDC-Dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--cb-accent)] hover:underline"
                  >
                    faucet
                  </a>
                  .
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Winners feed */}
        <section>
          <WinnersFeed />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--cb-border)] bg-[var(--cb-surface)]/50 py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--cb-text-muted)]">
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

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import PrivyConnect from '@/app/components/PrivyConnect';
import { gachaApi } from '@/lib/api';
import { getNftImageUrl, signTransaction } from '@/lib/solana';
import type { Nft, WalletAdapter } from '@/lib/types';
import { RARITY_COLORS, type Rarity } from '@/lib/types';

function getAttr(nft: Nft, trait: string): string | null {
  return nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === trait
  )?.value || null;
}

export default function CardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [nft, setNft] = React.useState<Nft | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  const [buying, setBuying] = React.useState(false);
  const [buyStatus, setBuyStatus] = React.useState<string | null>(null);
  const [buyError, setBuyError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { nfts } = await gachaApi.getNfts();
        const found = (nfts ?? []).find((n) => n.id === id);
        if (alive) {
          if (found) setNft(found);
          else setNotFound(true);
        }
      } catch {
        if (alive) setNotFound(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const handleBuy = async () => {
    if (!wallet || !nft) return;
    setBuyError(null);
    setBuyStatus('Generating transaction...');
    setBuying(true);

    const w = wallet as unknown as WalletAdapter;

    try {
      const { serializedTransaction, memo } = await gachaApi.buyback(w.address, nft.id);

      setBuyStatus('Please sign the transaction in your wallet...');
      const signed = await signTransaction(serializedTransaction, w);

      setBuyStatus('Submitting transaction...');
      await gachaApi.submitTransaction(signed);

      if (memo) {
        setBuyStatus('Confirming purchase...');
        await gachaApi.pollBuybackCheck(memo);
      }

      setBuyStatus('Purchase complete!');
    } catch (e) {
      setBuyError(e instanceof Error ? e.message : 'Purchase failed');
      setBuyStatus(null);
    } finally {
      setBuying(false);
    }
  };

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
          <p className="text-lg font-semibold text-[var(--cb-text-muted)]">Card not found</p>
          <Link href="/marketplace" className="text-[var(--cb-accent)] hover:underline text-sm">
            Back to Marketplace
          </Link>
        </main>
      </div>
    );
  }

  const name = nft.content?.metadata?.name || nft.id;
  const description = nft.content?.metadata?.description || null;
  const img = getNftImageUrl(nft);
  const rarity = getAttr(nft, 'Rarity') as Rarity | null;
  const grade = getAttr(nft, 'The Grade');
  const insuredValue = getAttr(nft, 'Insured Value');
  const owner = nft.ownership?.owner;
  const colors = rarity && rarity in RARITY_COLORS ? RARITY_COLORS[rarity] : null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1100px] mx-auto w-full px-4 py-6">
        {/* Back link */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Marketplace
        </Link>

        {/* Card detail */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image */}
          <div className={`rounded-2xl border overflow-hidden bg-[var(--cb-bg)] p-4 ${colors ? colors.border : 'border-[var(--cb-border)]'}`}>
            <div className="aspect-[3/4] relative">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt={name} className="w-full h-full object-contain rounded-xl" />
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
                <p className="text-sm text-[var(--cb-text-muted)] mt-2">{description}</p>
              )}
            </div>

            {/* Attributes */}
            <div className="space-y-3">
              {rarity && colors && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--cb-border)]">
                  <span className="text-sm text-[var(--cb-text-muted)]">Rarity</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                    {rarity}
                  </span>
                </div>
              )}
              {grade && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--cb-border)]">
                  <span className="text-sm text-[var(--cb-text-muted)]">Grade</span>
                  <span className="text-sm font-semibold">{grade}</span>
                </div>
              )}
              {insuredValue && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--cb-border)]">
                  <span className="text-sm text-[var(--cb-text-muted)]">Insured Value</span>
                  <span className="text-sm font-bold text-[var(--cb-accent)]">${insuredValue}</span>
                </div>
              )}
              {owner && (
                <div className="flex items-center justify-between py-2 border-b border-[var(--cb-border)]">
                  <span className="text-sm text-[var(--cb-text-muted)]">Owner</span>
                  <span className="text-xs font-mono text-[var(--cb-text-muted)]">
                    {owner.slice(0, 4)}...{owner.slice(-4)}
                  </span>
                </div>
              )}
            </div>

            {/* Buy section */}
            <div className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-4 space-y-3">
              {!authenticated ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm text-[var(--cb-text-muted)]">Connect your wallet to purchase this card.</p>
                  <PrivyConnect />
                </div>
              ) : (
                <>
                  <button
                    onClick={handleBuy}
                    disabled={buying || buyStatus === 'Purchase complete!'}
                    className="w-full py-3 rounded-lg bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-primary)] font-bold text-sm disabled:opacity-50 transition-colors"
                  >
                    {buying ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                        {buyStatus}
                      </span>
                    ) : buyStatus === 'Purchase complete!' ? (
                      'Purchased!'
                    ) : (
                      `Buy for $${insuredValue || '—'}`
                    )}
                  </button>
                  {buyError && (
                    <p className="text-xs text-[var(--cb-error)] text-center">{buyError}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
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

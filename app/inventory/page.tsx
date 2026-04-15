'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import PrivyConnect from '@/app/components/PrivyConnect';
import NftGallery from '@/app/components/NftGallery';
import { gachaApi } from '@/lib/api';
import { signMessage } from '@/lib/solana';
import type {
  PurchasedPack,
  GiftedPack,
  OpenPackResult,
  WalletAdapter,
} from '@/lib/types';
import { PACK_CONFIG } from '@/lib/types';
import PackReveal from '@/app/components/PackReveal';

export default function InventoryPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [tab, setTab] = React.useState<'collection' | 'purchased' | 'gifted'>(
    'collection'
  );
  const [purchasedPacks, setPurchasedPacks] = React.useState<PurchasedPack[]>(
    []
  );
  const [giftedPacks, setGiftedPacks] = React.useState<GiftedPack[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [revealResult, setRevealResult] =
    React.useState<OpenPackResult | null>(null);
  const [openingId, setOpeningId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!wallet?.address) return;
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const [purchased, gifted] = await Promise.allSettled([
          gachaApi.getPurchasedPacks(wallet.address),
          gachaApi.getGifted(wallet.address),
        ]);
        if (!alive) return;
        if (purchased.status === 'fulfilled')
          setPurchasedPacks(purchased.value.packs ?? []);
        if (gifted.status === 'fulfilled')
          setGiftedPacks(gifted.value.packs ?? []);
      } catch {
        /* noop */
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [wallet?.address, refreshKey]);

  const openGiftedPack = async (pack: GiftedPack) => {
    if (!wallet) return;
    setError(null);
    setOpeningId(pack.id);

    const w = wallet as unknown as WalletAdapter;

    try {
      const { nonce, messageToSign } =
        await gachaApi.generatePurchasedPack(w.address);
      const signature = await signMessage(messageToSign, w);
      await gachaApi.usePurchasedPack(w.address, signature, nonce);
      const result = await gachaApi.openPack(nonce);
      setRevealResult(result);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open pack');
    } finally {
      setOpeningId(null);
    }
  };

  const tabs = [
    { id: 'collection' as const, label: 'Collection' },
    { id: 'purchased' as const, label: 'Purchased Packs' },
    { id: 'gifted' as const, label: 'Gifted Packs' },
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
            {/* Tabs */}
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

            {error && (
              <div className="mb-4 p-3 rounded-lg border border-[var(--cb-error)]/30 bg-[var(--cb-error)]/10 text-sm text-[var(--cb-error)]">
                {error}
              </div>
            )}

            {tab === 'collection' && (
              <NftGallery owner={wallet?.address} key={refreshKey} />
            )}

            {tab === 'purchased' && (
              <div>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="spinner spinner-lg" />
                  </div>
                ) : purchasedPacks.length === 0 ? (
                  <div className="text-center py-12 text-[var(--cb-text-muted)]">
                    <p className="text-lg font-semibold">No purchased packs</p>
                    <p className="text-sm mt-1">
                      <Link href="/" className="text-[var(--cb-accent)] hover:underline">
                        Open the vending machine
                      </Link>{' '}
                      to get started.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {purchasedPacks.map((pack) => (
                      <div
                        key={pack.id}
                        className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-4 space-y-2"
                      >
                        <div className="text-xs text-[var(--cb-text-muted)]">
                          {new Date(pack.createdAt).toLocaleDateString()}
                        </div>
                        <div className="text-sm font-semibold">
                          {PACK_CONFIG[pack.packType]?.label ?? 'Pack'}
                        </div>
                        <div
                          className={`inline-block text-xs px-2 py-0.5 rounded-full ${
                            pack.status === 'opened'
                              ? 'bg-[var(--cb-success)]/20 text-[var(--cb-success)]'
                              : 'bg-[var(--cb-accent)]/20 text-[var(--cb-accent)]'
                          }`}
                        >
                          {pack.status}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'gifted' && (
              <div>
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="spinner spinner-lg" />
                  </div>
                ) : giftedPacks.length === 0 ? (
                  <div className="text-center py-12 text-[var(--cb-text-muted)]">
                    <p className="text-lg font-semibold">No gifted packs</p>
                    <p className="text-sm mt-1">
                      Gifted packs from other users will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {giftedPacks.map((pack) => (
                      <div
                        key={pack.id}
                        className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-4 space-y-3"
                      >
                        <div className="text-xs text-[var(--cb-text-muted)]">
                          From {pack.sender.slice(0, 4)}...
                          {pack.sender.slice(-4)}
                        </div>
                        <div className="text-sm font-semibold">
                          {PACK_CONFIG[pack.packType]?.label ?? 'Pack'}
                        </div>
                        {pack.status === 'pending' && (
                          <button
                            onClick={() => openGiftedPack(pack)}
                            disabled={openingId === pack.id}
                            className="w-full py-2 rounded-lg bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] text-sm font-bold disabled:opacity-50 transition-colors"
                          >
                            {openingId === pack.id ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                Opening...
                              </span>
                            ) : (
                              'Open Pack'
                            )}
                          </button>
                        )}
                        {pack.status !== 'pending' && (
                          <div className="text-xs text-[var(--cb-success)]">
                            Opened
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
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

      {revealResult && (
        <PackReveal
          results={[revealResult]}
          onClose={() => {
            setRevealResult(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

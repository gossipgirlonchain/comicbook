'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import PrivyConnect from '@/app/components/PrivyConnect';
import NftGallery from '@/app/components/NftGallery';
import { gachaApi } from '@/lib/api';
import type { PurchasedPack } from '@/lib/types';
import { PACK_CONFIG } from '@/lib/types';

export default function InventoryPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [tab, setTab] = React.useState<'collection' | 'purchased'>(
    'collection'
  );
  const [purchasedPacks, setPurchasedPacks] = React.useState<PurchasedPack[]>(
    []
  );
  const [loading, setLoading] = React.useState(false);
  const [refreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!wallet?.address) return;
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const purchased = await gachaApi.getPurchasedPacks(wallet.address);
        if (!alive) return;
        setPurchasedPacks(purchased.packs ?? []);
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

  const tabs = [
    { id: 'collection' as const, label: 'Collection' },
    { id: 'purchased' as const, label: 'Purchased Packs' },
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

          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

'use client';

import * as React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import PrivyConnect from '@/app/components/PrivyConnect';
import ProfileIdentity from '@/app/components/ProfileIdentity';
import { gachaApi } from '@/lib/api';
import { getNftImageUrl } from '@/lib/solana';
import type { Winner } from '@/lib/types';
import { RARITY_COLORS, type Rarity } from '@/lib/types';
import { readProfile, type UserProfile } from '@/lib/profile-storage';
import { winnersToCollection, type OwnedCard } from '@/lib/collection';

export default function ProfilePage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [winners, setWinners] = React.useState<Winner[]>([]);
  const [usdcBalance, setUsdcBalance] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<UserProfile>({
    username: null,
    avatarDataUrl: null,
  });
  // Forces the winners-derived collection to re-read localStorage after a
  // buyback (since the sold-back set lives there, not in React state).
  const [soldKey, setSoldKey] = React.useState(0);

  React.useEffect(() => {
    if (wallet?.address) setProfile(readProfile(wallet.address));
  }, [wallet?.address]);

  // Re-read sold-back list when localStorage changes in another tab/component.
  React.useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('cb-sold-back:')) setSoldKey((k) => k + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  React.useEffect(() => {
    if (!wallet?.address) return;
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const [winnersRes, balanceRes] = await Promise.allSettled([
          gachaApi.getAllWinners(),
          fetch('/api/getUsdcBalance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: wallet.address }),
          }).then((r) => r.json()),
        ]);

        if (!alive) return;
        if (winnersRes.status === 'fulfilled') setWinners(winnersRes.value.winners ?? []);
        if (balanceRes.status === 'fulfilled') setUsdcBalance(balanceRes.value.balance ?? 0);
      } catch { /* */ }
      finally { if (alive) setLoading(false); }
    };

    load();
    return () => { alive = false; };
  }, [wallet?.address]);

  const myWins = React.useMemo(() => {
    if (!wallet?.address) return [];
    return winners.filter((w) => w.playerAddress === wallet.address);
  }, [winners, wallet?.address]);

  // Current collection = wins MINUS anything sold back (tracked locally).
  // soldKey is in deps so this recomputes after a buyback updates localStorage.
  const myCollection = React.useMemo<OwnedCard[]>(() => {
    return winnersToCollection(winners, wallet?.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winners, wallet?.address, soldKey]);

  const rarityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      Legendary: 0, Epic: 0, Rare: 0, Uncommon: 0, Common: 0,
    };
    myCollection.forEach((card) => {
      if (card.rarity && card.rarity in counts) counts[card.rarity]++;
    });
    return counts;
  }, [myCollection]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-6">
        {!ready ? (
          <div className="flex justify-center py-20">
            <div className="spinner spinner-lg" />
          </div>
        ) : !authenticated ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-[var(--cb-text-muted)] text-lg">Connect your wallet to view your profile.</p>
            <PrivyConnect />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile header */}
            <ProfileIdentity
              address={wallet?.address}
              profile={profile}
              onProfileChange={setProfile}
            />

            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard label="Balance" value={usdcBalance !== null ? `$${usdcBalance.toFixed(2)}` : '-'} color="text-[var(--cb-success)]" loading={loading} />
              <StatCard label="Collectibles" value={String(myCollection.length)} color="text-[var(--cb-text)]" loading={loading} />
              <StatCard label="Machine Pulls" value={String(myWins.length)} color="text-[var(--cb-text)]" loading={loading} />
            </div>

            {/* Collection breakdown + Recent wins */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Rarity breakdown */}
              <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--cb-text-muted)] mb-4">
                  Collection by Rarity
                </h2>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-8 rounded bg-[var(--cb-bg)] animate-pulse" />
                    ))}
                  </div>
                ) : myCollection.length === 0 ? (
                  <p className="text-sm text-[var(--cb-text-muted)]">No collectibles yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'] as Rarity[]).map((rarity) => {
                      const count = rarityCounts[rarity] || 0;
                      const pct = myCollection.length > 0 ? (count / myCollection.length) * 100 : 0;
                      const colors = RARITY_COLORS[rarity];
                      return (
                        <div key={rarity} className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded w-24 text-center ${colors.bg} ${colors.text}`}>
                            {rarity}
                          </span>
                          <div className="flex-1 h-6 rounded-full bg-[var(--cb-bg)] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(pct, count > 0 ? 3 : 0)}%`,
                                backgroundColor: `var(--rarity-${rarity.toLowerCase()})`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold tabular-nums w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent pulls */}
              <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--cb-text-muted)] mb-4">
                  Your Recent Pulls
                </h2>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-12 rounded bg-[var(--cb-bg)] animate-pulse" />
                    ))}
                  </div>
                ) : myWins.length === 0 ? (
                  <p className="text-sm text-[var(--cb-text-muted)]">No pulls yet. Pull the machine to get started!</p>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto">
                    {myWins.slice(0, 20).map((win, i) => {
                      const colors = RARITY_COLORS[win.rarity] || RARITY_COLORS.Common;
                      return (
                        <div key={`${win.transactionSignature}-${i}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--cb-surface-hover)] transition-colors">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--cb-bg)] flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={getNftImageUrl(win.nftWon)} alt="" className="w-full h-full object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{win.nftWon.content.metadata.name}</p>
                            <span className={`inline-block text-[9px] font-bold px-1 py-px rounded ${colors.bg} ${colors.text} mt-0.5`}>
                              {win.rarity}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

function StatCard({ label, value, color, loading }: { label: string; value: string; color: string; loading: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-4">
      <span className="text-[10px] font-semibold text-[var(--cb-text-muted)] uppercase tracking-wider">{label}</span>
      {loading ? (
        <div className="h-7 mt-1 rounded bg-[var(--cb-bg)] animate-pulse" />
      ) : (
        <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
      )}
    </div>
  );
}

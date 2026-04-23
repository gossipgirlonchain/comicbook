'use client';

import * as React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import PrivyConnect from '@/app/components/PrivyConnect';
import ProfileIdentity from '@/app/components/ProfileIdentity';
import { getNftImageUrl } from '@/lib/solana';
import type { MachinePull } from '@/lib/types';
import { RARITY_COLORS, type Rarity } from '@/lib/types';
import { readProfile, type UserProfile } from '@/lib/profile-storage';
import { getSoldBackIds } from '@/lib/collection';

export default function ProfilePage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [pulls, setPulls] = React.useState<MachinePull[]>([]);
  const [usdcBalance, setUsdcBalance] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<UserProfile>({
    username: null,
    avatarDataUrl: null,
  });
  // Forces the collection to recompute after a buyback (sold-back set lives
  // in localStorage, not in React state).
  const [soldKey, setSoldKey] = React.useState(0);

  React.useEffect(() => {
    if (wallet?.address) setProfile(readProfile(wallet.address));
  }, [wallet?.address]);

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
        const [pullsRes, balanceRes] = await Promise.allSettled([
          fetch(
            `/api/machinePulls?address=${encodeURIComponent(wallet.address)}`,
            { cache: 'no-store' }
          ).then(async (r) => {
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
            return data as { pulls: MachinePull[] };
          }),
          fetch('/api/getUsdcBalance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: wallet.address }),
          }).then((r) => r.json()),
        ]);

        if (!alive) return;
        if (pullsRes.status === 'fulfilled') {
          setPulls(pullsRes.value.pulls ?? []);
        } else {
          console.error('[profile] load pulls failed:', pullsRes.reason);
        }
        if (balanceRes.status === 'fulfilled')
          setUsdcBalance(balanceRes.value.balance ?? 0);
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [wallet?.address]);

  // All machine pulls (used for the "Machine Pulls" count and recent list).
  // Includes failed on-chain attempts — those are still pulls the user made.
  const myPulls = pulls;

  // Collection = pulls that resolved to a card, minus sold-back mints.
  const myCollection = React.useMemo(() => {
    if (!wallet?.address) return [] as MachinePull[];
    const sold = getSoldBackIds(wallet.address);
    return pulls.filter((p) => p.card && !sold.has(p.card.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulls, wallet?.address, soldKey]);

  const rarityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      Legendary: 0,
      Epic: 0,
      Rare: 0,
      Uncommon: 0,
      Common: 0,
    };
    myCollection.forEach((p) => {
      const r = p.card?.rarity;
      if (r && r in counts) counts[r]++;
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
            <p className="text-[var(--cb-text-muted)] text-lg">
              Connect your wallet to view your profile.
            </p>
            <PrivyConnect />
          </div>
        ) : (
          <div className="space-y-6">
            <ProfileIdentity
              address={wallet?.address}
              profile={profile}
              onProfileChange={setProfile}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard
                label="Balance"
                value={
                  usdcBalance !== null ? `$${usdcBalance.toFixed(2)}` : '-'
                }
                color="text-[var(--cb-success)]"
                loading={loading}
              />
              <StatCard
                label="Collectibles"
                value={String(myCollection.length)}
                color="text-[var(--cb-text)]"
                loading={loading}
              />
              <StatCard
                label="Machine Pulls"
                value={String(myPulls.length)}
                color="text-[var(--cb-text)]"
                loading={loading}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--cb-text-muted)] mb-4">
                  Collection by Rarity
                </h2>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-8 rounded bg-[var(--cb-bg)] animate-pulse"
                      />
                    ))}
                  </div>
                ) : myCollection.length === 0 ? (
                  <p className="text-sm text-[var(--cb-text-muted)]">
                    No collectibles yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {(
                      ['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'] as Rarity[]
                    ).map((rarity) => {
                      const count = rarityCounts[rarity] || 0;
                      const pct =
                        myCollection.length > 0
                          ? (count / myCollection.length) * 100
                          : 0;
                      const colors = RARITY_COLORS[rarity];
                      return (
                        <div key={rarity} className="flex items-center gap-3">
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded w-24 text-center ${colors.bg} ${colors.text}`}
                          >
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
                          <span className="text-sm font-bold tabular-nums w-8 text-right">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--cb-text-muted)] mb-4">
                  Your Recent Pulls
                </h2>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-12 rounded bg-[var(--cb-bg)] animate-pulse"
                      />
                    ))}
                  </div>
                ) : myPulls.length === 0 ? (
                  <p className="text-sm text-[var(--cb-text-muted)]">
                    No pulls yet. Pull the machine to get started!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto">
                    {myPulls.slice(0, 20).map((p) => (
                      <RecentPullRow key={p.memo} pull={p} />
                    ))}
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

function RecentPullRow({ pull }: { pull: MachinePull }) {
  const rarity = pull.card?.rarity;
  const colors = rarity ? RARITY_COLORS[rarity] : null;
  const name = pull.card?.nftWon.content.metadata.name ?? 'Pull';
  const img = pull.card ? getNftImageUrl(pull.card.nftWon) : null;

  const chip = (() => {
    if (pull.card) {
      return (
        colors && (
          <span
            className={`inline-block text-[9px] font-bold px-1 py-px rounded ${colors.bg} ${colors.text} mt-0.5`}
          >
            {rarity}
          </span>
        )
      );
    }
    if (pull.hasError) {
      return (
        <span className="inline-block text-[9px] font-bold px-1 py-px rounded bg-[var(--cb-error)]/20 text-[var(--cb-error)] mt-0.5">
          On-chain failed
        </span>
      );
    }
    return (
      <span className="inline-block text-[9px] font-bold px-1 py-px rounded bg-[var(--cb-warning)]/20 text-[var(--cb-warning)] mt-0.5">
        Pending reveal
      </span>
    );
  })();

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--cb-surface-hover)] transition-colors">
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--cb-bg)] flex-shrink-0">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt="" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{name}</p>
        {chip}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: string;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-4">
      <span className="text-[10px] font-semibold text-[var(--cb-text-muted)] uppercase tracking-wider">
        {label}
      </span>
      {loading ? (
        <div className="h-7 mt-1 rounded bg-[var(--cb-bg)] animate-pulse" />
      ) : (
        <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
      )}
    </div>
  );
}

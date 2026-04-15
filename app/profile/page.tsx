'use client';

import * as React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import PrivyConnect from '@/app/components/PrivyConnect';
import ProfileIdentity from '@/app/components/ProfileIdentity';
import { gachaApi } from '@/lib/api';
import { getNftImageUrl } from '@/lib/solana';
import type { Nft, Winner } from '@/lib/types';
import { RARITY_COLORS, type Rarity } from '@/lib/types';
import { readProfile, type UserProfile } from '@/lib/profile-storage';

function getRarity(nft: Nft): Rarity | null {
  const v = nft.content?.metadata?.attributes?.find(
    (a) => a.trait_type === 'Rarity'
  )?.value;
  if (v && v in RARITY_COLORS) return v as Rarity;
  return null;
}

type LeaderboardEntry = {
  playerAddress: string;
  points: number;
  totalPoints?: number;
};

export default function ProfilePage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [nfts, setNfts] = React.useState<Nft[]>([]);
  const [winners, setWinners] = React.useState<Winner[]>([]);
  const [usdcBalance, setUsdcBalance] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [profile, setProfile] = React.useState<UserProfile>({
    username: null,
    avatarDataUrl: null,
  });

  React.useEffect(() => {
    if (wallet?.address) setProfile(readProfile(wallet.address));
  }, [wallet?.address]);

  React.useEffect(() => {
    if (!wallet?.address) return;
    let alive = true;

    const load = async () => {
      setLoading(true);
      try {
        const [nftRes, winnersRes, balanceRes] = await Promise.allSettled([
          gachaApi.getNfts(wallet.address),
          gachaApi.getAllWinners(),
          fetch('/api/getUsdcBalance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address: wallet.address }),
          }).then((r) => r.json()),
        ]);

        if (!alive) return;
        if (nftRes.status === 'fulfilled') {
          const all = nftRes.value.nfts ?? [];
          setNfts(all.filter((n) => n.ownership?.owner === wallet.address));
        }
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

  const totalPoints = React.useMemo(() => {
    return myWins.reduce((sum, w) => sum + (w.points || 0), 0);
  }, [myWins]);

  const rarityCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      Legendary: 0, Epic: 0, Rare: 0, Uncommon: 0, Common: 0,
    };
    nfts.forEach((nft) => {
      const r = getRarity(nft);
      if (r && r in counts) counts[r]++;
    });
    return counts;
  }, [nfts]);

  const leaderboard = React.useMemo((): LeaderboardEntry[] => {
    const map = new Map<string, number>();
    winners.forEach((w) => {
      map.set(w.playerAddress, (map.get(w.playerAddress) || 0) + (w.points || 0));
    });
    return Array.from(map.entries())
      .map(([playerAddress, points]) => ({ playerAddress, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 25);
  }, [winners]);

  const myRank = React.useMemo(() => {
    if (!wallet?.address) return null;
    const idx = leaderboard.findIndex((e) => e.playerAddress === wallet.address);
    return idx >= 0 ? idx + 1 : null;
  }, [leaderboard, wallet?.address]);

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
              rank={myRank}
            />

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Balance" value={usdcBalance !== null ? `$${usdcBalance.toFixed(2)}` : '-'} color="text-[var(--cb-success)]" loading={loading} />
              <StatCard label="Total Points" value={totalPoints.toLocaleString()} color="text-[var(--cb-accent)]" loading={loading} />
              <StatCard label="NFTs Owned" value={String(nfts.length)} color="text-[var(--cb-text)]" loading={loading} />
              <StatCard label="Packs Opened" value={String(myWins.length)} color="text-[var(--cb-text)]" loading={loading} />
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
                ) : nfts.length === 0 ? (
                  <p className="text-sm text-[var(--cb-text-muted)]">No NFTs in collection yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(['Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'] as Rarity[]).map((rarity) => {
                      const count = rarityCounts[rarity] || 0;
                      const pct = nfts.length > 0 ? (count / nfts.length) * 100 : 0;
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

              {/* Recent wins */}
              <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-5">
                <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--cb-text-muted)] mb-4">
                  Your Recent Wins
                </h2>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-12 rounded bg-[var(--cb-bg)] animate-pulse" />
                    ))}
                  </div>
                ) : myWins.length === 0 ? (
                  <p className="text-sm text-[var(--cb-text-muted)]">No wins yet. Open a pack to get started!</p>
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
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-bold px-1 py-px rounded ${colors.bg} ${colors.text}`}>
                                {win.rarity}
                              </span>
                              <span className="text-[10px] text-[var(--cb-accent)] font-bold">
                                +{win.points} pts
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Leaderboard */}
            <div className="rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--cb-text-muted)] mb-4">
                Leaderboard
              </h2>
              {winners.length === 0 ? (
                <p className="text-sm text-[var(--cb-text-muted)]">Loading leaderboard...</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--cb-text-muted)] text-xs uppercase tracking-wider border-b border-[var(--cb-border)]">
                        <th className="pb-3 pr-4 w-12">Rank</th>
                        <th className="pb-3 pr-4">Wallet</th>
                        <th className="pb-3 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((entry, i) => {
                        const isMe = wallet?.address === entry.playerAddress;
                        return (
                          <tr
                            key={entry.playerAddress}
                            className={`border-b border-[var(--cb-border)]/50 ${isMe ? 'bg-[var(--cb-accent)]/5' : ''}`}
                          >
                            <td className="py-3 pr-4">
                              <span className={`font-bold ${i < 3 ? 'text-[var(--cb-accent)]' : 'text-[var(--cb-text-muted)]'}`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`text-xs ${isMe ? 'text-[var(--cb-accent)] font-bold' : 'text-[var(--cb-text)]'}`}>
                                {isMe && profile.username ? (
                                  <span className="font-semibold">{profile.username}</span>
                                ) : (
                                  <span className="font-mono">
                                    {entry.playerAddress.slice(0, 6)}...{entry.playerAddress.slice(-6)}
                                  </span>
                                )}
                                {isMe && <span className="ml-2 text-[10px] text-[var(--cb-accent)]">(you)</span>}
                              </span>
                            </td>
                            <td className="py-3 text-right">
                              <span className="font-bold tabular-nums">{entry.points.toLocaleString()}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
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

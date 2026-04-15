/**
 * User collection derivation.
 *
 * CC's `getNfts` endpoint returns their house inventory pool, NOT what a user
 * owns — every NFT is owned by one of CC's pool wallets (LGNDkso..., Lowovru...,
 * MidJLFX..., HighMAx..., Epicazw...). Filtering by `ownership.owner === user`
 * returns zero matches, which is why "My Collection" was always empty.
 *
 * The correct source of truth for a user's collection is the `getAllWinners`
 * feed, filtered by `playerAddress`. That's the same data that already powers
 * "Recent Wins" on the profile page.
 *
 * Sold-back tracking: CC doesn't expose a per-card buyback status today, so we
 * track sold nft_addresses locally in localStorage as a pragmatic stopgap.
 * TODO: replace with a real server-side flag once CC adds it.
 */

import type { Winner, NftWon, Rarity } from './types';

const SOLD_KEY = (address: string) => `cb-sold-back:${address}`;

export function getSoldBackIds(address: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SOLD_KEY(address));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function markSoldBack(address: string, nftAddress: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getSoldBackIds(address);
    current.add(nftAddress);
    localStorage.setItem(
      SOLD_KEY(address),
      JSON.stringify(Array.from(current))
    );
  } catch {
    /* quota exceeded or disabled */
  }
}

export type OwnedCard = {
  /** Mint address — used for routing to /cards/[id] */
  id: string;
  nftWon: NftWon;
  rarity: Rarity;
  points: number;
  timestamp: string;
  transactionSignature: string;
};

/**
 * Derive the user's current collection from the global winners feed.
 * Filters out any cards the user has sold back (tracked in localStorage).
 */
export function winnersToCollection(
  winners: Winner[],
  walletAddress: string | undefined
): OwnedCard[] {
  if (!walletAddress) return [];
  const sold = getSoldBackIds(walletAddress);
  return winners
    .filter((w) => w.playerAddress === walletAddress)
    .filter((w) => {
      const mint = w.nft_address ?? w.nftWon.id;
      return !sold.has(mint);
    })
    .map((w) => ({
      id: w.nft_address ?? w.nftWon.id,
      nftWon: w.nftWon,
      rarity: w.rarity,
      points: w.points,
      timestamp: w.timestamp,
      transactionSignature: w.transactionSignature,
    }));
}

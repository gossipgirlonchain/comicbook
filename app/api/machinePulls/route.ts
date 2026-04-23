import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import type { MachinePull, NftWon, Rarity } from '@/lib/types';
import { insuredValueToRarity } from '@/lib/types';

const RPC_URL = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';
const CC_BASE = process.env.COLLECTOR_CRYPT_BASE_URL;
const CC_KEY = process.env.COLLECTOR_CRYPT_API_KEY;

// getSignaturesForAddress returns memos in the form "[<len>] cb-<uuid>",
// where [<len>] is the memo program's length prefix. We extract just the
// cb-<uuid> slug because that's the pull identifier CC echoes back as
// memo_slug on the winners feed and accepts on openPack.
const MEMO_RE = /(cb-[0-9a-f-]{36})/i;

type ResolvedCard = {
  id: string;
  nftWon: NftWon;
  rarity: Rarity | null;
  insuredValue: string | null;
};

type EnrichedPull = MachinePull & {
  card?: ResolvedCard;
};

async function resolveCard(memo: string): Promise<ResolvedCard | null> {
  if (!CC_BASE || !CC_KEY) return null;
  try {
    const res = await fetch(`${CC_BASE}/api/openPack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CC_KEY,
      },
      body: JSON.stringify({ memo }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success || !data.nft_address || !data.nftWon) return null;

    const attrs: Array<{ trait_type: string; value: string }> =
      data.nftWon.content?.metadata?.attributes ?? [];
    const rarityAttr =
      (attrs.find((a) => a.trait_type === 'Rarity')?.value as Rarity | undefined) ??
      null;
    const insuredValue =
      attrs.find((a) => a.trait_type === 'Insured Value')?.value ?? null;
    // CC's metadata rarely ships the Rarity trait today, so fall back to
    // bucketing by insuredValue — same logic the winners feed uses.
    const rarity: Rarity | null =
      rarityAttr ?? (insuredValue ? insuredValueToRarity(insuredValue) : null);

    return {
      id: data.nft_address,
      nftWon: data.nftWon,
      rarity,
      insuredValue,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(address);
  } catch {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  try {
    const conn = new Connection(RPC_URL, 'confirmed');
    const sigs = await conn.getSignaturesForAddress(pubkey, { limit: 200 });

    const byPull = new Map<string, MachinePull>();
    for (const s of sigs) {
      const match = s.memo?.match(MEMO_RE);
      if (!match) continue;
      const memo = match[1];
      const existing = byPull.get(memo);
      if (!existing) {
        byPull.set(memo, {
          memo,
          firstSignature: s.signature,
          firstBlockTime: s.blockTime ?? null,
          txCount: 1,
          hasError: !!s.err,
        });
        continue;
      }
      existing.txCount++;
      if (s.err) existing.hasError = true;
      if (
        s.blockTime != null &&
        (existing.firstBlockTime == null ||
          s.blockTime < existing.firstBlockTime)
      ) {
        existing.firstBlockTime = s.blockTime;
        existing.firstSignature = s.signature;
      }
    }

    const raw = Array.from(byPull.values()).sort(
      (a, b) => (b.firstBlockTime ?? 0) - (a.firstBlockTime ?? 0)
    );

    // Resolve cards for non-failed pulls in parallel. CC's openPack returns
    // the card bound to this memo even after the original webhook has fired
    // (or never fired), so this works as our source of truth for "what did
    // this pull win" even when /getAllWinners is stale.
    const pulls: EnrichedPull[] = await Promise.all(
      raw.map(async (p) => {
        if (p.hasError) return p;
        const card = await resolveCard(p.memo);
        return card ? { ...p, card } : p;
      })
    );

    return NextResponse.json({ pulls });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'RPC error' },
      { status: 500 }
    );
  }
}

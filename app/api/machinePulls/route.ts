import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import type { MachinePull } from '@/lib/types';

const RPC_URL = process.env.SOLANA_RPC || 'https://api.devnet.solana.com';

// getSignaturesForAddress returns memos in the form "[<len>] cb-<uuid>",
// where [<len>] is the memo program's length prefix. We extract just the
// cb-<uuid> slug because that's the pull identifier CC echoes back as
// memo_slug on the winners feed.
const MEMO_RE = /(cb-[0-9a-f-]{36})/i;

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

    const pulls = Array.from(byPull.values()).sort(
      (a, b) => (b.firstBlockTime ?? 0) - (a.firstBlockTime ?? 0)
    );
    return NextResponse.json({ pulls });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'RPC error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';

const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT_ADDRESS!;
const RPC_URL =
  process.env.SOLANA_RPC || 'https://api.devnet.solana.com';

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const connection = new Connection(RPC_URL);
    const walletPubkey = new PublicKey(address);
    const mintPubkey = new PublicKey(USDC_MINT);

    const tokenAccounts =
      await connection.getParsedTokenAccountsByOwner(walletPubkey, {
        mint: mintPubkey,
      });

    let balance = 0;
    if (tokenAccounts.value.length > 0) {
      const info =
        tokenAccounts.value[0].account.data.parsed.info;
      balance = info.tokenAmount.uiAmount || 0;
    }

    return NextResponse.json({ balance });
  } catch {
    return NextResponse.json(
      { error: 'Failed to fetch USDC balance' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, importPKCS8 } from 'jose';
import crypto from 'crypto';

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || '';
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || '';

async function generateCdpJwt(uri: string) {
  const privateKey = await importPKCS8(CDP_API_KEY_SECRET, 'ES256');
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    sub: CDP_API_KEY_ID,
    iss: 'cdp',
    aud: ['cdp_service'],
    uris: [uri],
  })
    .setProtectedHeader({
      alg: 'ES256',
      kid: CDP_API_KEY_ID,
      nonce: crypto.randomBytes(16).toString('hex'),
      typ: 'JWT',
    })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 120)
    .sign(privateKey);
}

export async function POST(req: NextRequest) {
  try {
    if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET) {
      return NextResponse.json(
        { error: 'Card payments are not available right now. Please try again later.' },
        { status: 503 }
      );
    }

    const { address } = await req.json();
    if (!address || typeof address !== 'string') {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const uri = 'https://api.developer.coinbase.com/onramp/v1/token';
    const jwt = await generateCdpJwt(uri);

    const res = await fetch(uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        addresses: [{ address, blockchains: ['solana'] }],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[coinbase/onramp] token error:', data);
      return NextResponse.json(
        { error: 'Failed to generate onramp session' },
        { status: res.status }
      );
    }

    const onrampUrl = `https://pay.coinbase.com/buy/select-asset?sessionToken=${encodeURIComponent(data.token)}&defaultAsset=USDC&defaultNetwork=solana`;

    return NextResponse.json({ url: onrampUrl });
  } catch (e) {
    console.error('[coinbase/onramp] error:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

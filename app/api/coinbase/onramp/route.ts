import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, importPKCS8, importJWK } from 'jose';
import crypto from 'crypto';

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || '';
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || '';

// Normalize `\n` / `\r\n` escape sequences back to real newlines. Vercel env
// vars frequently store multi-line PEMs with literal `\n`, which breaks
// importPKCS8.
function normalizePem(raw: string): string {
  return raw.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').trim();
}

// CDP JWT `uris` claim format: "<METHOD> <host><path>" — NOT the full https
// URL. Passing the full URL causes Coinbase to reject the token with 401.
function formatJwtUri(method: string, fullUrl: string): string {
  const u = new URL(fullUrl);
  return `${method.toUpperCase()} ${u.host}${u.pathname}`;
}

// CDP issues two key formats today:
//   1. Legacy ECDSA P-256 — PKCS#8 PEM starting with "-----BEGIN".
//   2. Current Ed25519   — base64 of 64 bytes (32-byte seed || 32-byte pub).
// Detect by the PEM header; fall back to Ed25519. Signing alg flips with it.
async function resolveSigner(secret: string): Promise<{
  key: Awaited<ReturnType<typeof importPKCS8>>;
  alg: 'ES256' | 'EdDSA';
}> {
  const trimmed = normalizePem(secret);
  if (trimmed.startsWith('-----BEGIN')) {
    return { key: await importPKCS8(trimmed, 'ES256'), alg: 'ES256' };
  }
  const raw = Buffer.from(trimmed, 'base64');
  if (raw.length !== 64) {
    throw new Error(
      `CDP_API_KEY_SECRET: expected PKCS#8 PEM or 64-byte base64 Ed25519 key, got ${raw.length}-byte base64`
    );
  }
  const seed = raw.subarray(0, 32);
  const pub = raw.subarray(32, 64);
  const jwk = {
    kty: 'OKP',
    crv: 'Ed25519',
    d: seed.toString('base64url'),
    x: pub.toString('base64url'),
  };
  const key = await importJWK(jwk, 'EdDSA');
  return { key: key as Awaited<ReturnType<typeof importPKCS8>>, alg: 'EdDSA' };
}

async function generateCdpJwt(method: string, fullUrl: string) {
  const { key, alg } = await resolveSigner(CDP_API_KEY_SECRET);
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({
    sub: CDP_API_KEY_ID,
    iss: 'cdp',
    aud: ['cdp_service'],
    uris: [formatJwtUri(method, fullUrl)],
  })
    .setProtectedHeader({
      alg,
      kid: CDP_API_KEY_ID,
      nonce: crypto.randomBytes(16).toString('hex'),
      typ: 'JWT',
    })
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(now + 120)
    .sign(key);
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

    const url = 'https://api.developer.coinbase.com/onramp/v1/token';
    const jwt = await generateCdpJwt('POST', url);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        addresses: [{ address, blockchains: ['solana'] }],
      }),
    });

    const data = await res.json().catch(() => ({} as { token?: string; message?: string }));

    if (!res.ok) {
      console.error('[coinbase/onramp] token error:', res.status, data);
      return NextResponse.json(
        { error: data?.message || 'Failed to generate onramp session' },
        { status: res.status }
      );
    }

    if (!data?.token) {
      console.error('[coinbase/onramp] missing token in response:', data);
      return NextResponse.json(
        { error: 'Coinbase did not return a session token' },
        { status: 502 }
      );
    }

    const onrampUrl = `https://pay.coinbase.com/buy/select-asset?sessionToken=${encodeURIComponent(data.token)}&defaultAsset=USDC&defaultNetwork=solana`;

    return NextResponse.json({ url: onrampUrl });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : 'unknown';
    console.error('[coinbase/onramp] error:', msg, e);
    return NextResponse.json(
      // Surface the cause class (e.g. TypeError on bad PEM) without leaking
      // key material. Helps distinguish key-parse from API failures in prod.
      { error: `Onramp setup failed (${msg})` },
      { status: 500 }
    );
  }
}

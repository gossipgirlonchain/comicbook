import { NextRequest, NextResponse } from 'next/server';
import {
  SignJWT,
  importPKCS8,
  importJWK,
  jwtVerify,
  createRemoteJWKSet,
} from 'jose';
import crypto from 'crypto';

const CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || '';
const CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || '';
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

// Privy access tokens are signed ES256 JWTs. Verifying against the public
// JWKS doesn't require a server secret — the app ID alone is enough, and
// jose caches the JWKS across requests on the module.
const PRIVY_JWKS = PRIVY_APP_ID
  ? createRemoteJWKSet(
      new URL(
        `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`
      )
    )
  : null;

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

async function verifyPrivyCaller(req: NextRequest): Promise<string | null> {
  if (!PRIVY_JWKS) return null;
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], PRIVY_JWKS, {
      issuer: 'privy.io',
      audience: PRIVY_APP_ID,
    });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

// Coinbase requires a real client IP so the session token is bound to the
// originating user. Behind Vercel, the real IP is the first entry in the
// x-forwarded-for list; x-real-ip is a backup that some providers populate.
function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return null;
}

// Simple per-IP rate limiter: 10 token requests / 5 minutes. Prevents a
// logged-in attacker from farming session tokens from our backend.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 5 * 60_000;
const RL_MAX = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RL_MAX;
}

export async function POST(req: NextRequest) {
  try {
    const privyUserId = await verifyPrivyCaller(req);
    if (!privyUserId) {
      return NextResponse.json(
        { error: 'Sign in to continue.' },
        { status: 401 }
      );
    }

    if (!CDP_API_KEY_ID || !CDP_API_KEY_SECRET) {
      return NextResponse.json(
        { error: 'Card payments are not available right now. Please try again later.' },
        { status: 503 }
      );
    }

    const clientIp = getClientIp(req);
    if (!clientIp) {
      // Coinbase rejects session tokens without a client IP. Failing here
      // produces a clearer error than letting Coinbase 400.
      return NextResponse.json(
        { error: 'Unable to determine client IP' },
        { status: 400 }
      );
    }

    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a few minutes.' },
        { status: 429 }
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
        clientIp,
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

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';

const COINFLOW_API_KEY = process.env.COINFLOW_API_KEY || '';
const COINFLOW_ENV = process.env.NEXT_PUBLIC_COINFLOW_ENV || 'sandbox';
const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';

// Sandbox vs prod base — staging/staging-live exist too but the React SDK
// pairs them with the same hosts under the hood; for our purposes only
// sandbox / prod matter.
const COINFLOW_BASE =
  COINFLOW_ENV === 'prod'
    ? 'https://api.coinflow.cash'
    : 'https://api-sandbox.coinflow.cash';

const PRIVY_JWKS = PRIVY_APP_ID
  ? createRemoteJWKSet(
      new URL(
        `https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`
      )
    )
  : null;

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

function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || null;
}

// Per-IP rate limiter: 30 session keys / 5 minutes. Coinflow keys are
// short-lived JWTs (30 min) so a logged-in user might legitimately
// request several over a session.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RL_WINDOW_MS = 5 * 60_000;
const RL_MAX = 30;

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

    if (!COINFLOW_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Card payments are not available right now. Please try again later.',
        },
        { status: 503 }
      );
    }

    const ip = getClientIp(req) ?? 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a few minutes.' },
        { status: 429 }
      );
    }

    const { wallet } = await req.json();
    if (!wallet || typeof wallet !== 'string') {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    const res = await fetch(`${COINFLOW_BASE}/api/auth/session-key`, {
      method: 'GET',
      headers: {
        Authorization: COINFLOW_API_KEY,
        accept: 'application/json',
        'x-coinflow-auth-blockchain': 'solana',
        'x-coinflow-auth-wallet': wallet,
      },
    });

    const data = await res
      .json()
      .catch(() => ({} as { key?: string; message?: string }));

    if (!res.ok) {
      console.error('[coinflow/sessionKey] error:', res.status, data);
      return NextResponse.json(
        { error: data?.message || 'Failed to start checkout' },
        { status: res.status }
      );
    }

    if (!data?.key) {
      console.error('[coinflow/sessionKey] missing key:', data);
      return NextResponse.json(
        { error: 'Coinflow did not return a session key' },
        { status: 502 }
      );
    }

    return NextResponse.json({ sessionKey: data.key, env: COINFLOW_ENV });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : 'unknown';
    console.error('[coinflow/sessionKey] error:', msg, e);
    return NextResponse.json(
      { error: `Coinflow setup failed (${msg})` },
      { status: 500 }
    );
  }
}

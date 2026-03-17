import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.COLLECTOR_CRYPT_BASE_URL!;
const API_KEY = process.env.COLLECTOR_CRYPT_API_KEY!;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path.join('/');

  try {
    const body = await req.json().catch(() => ({}));
    const res = await fetch(`${BASE}/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path.join('/');
  const search = req.nextUrl.searchParams.toString();
  const url = `${BASE}/api/${endpoint}${search ? `?${search}` : ''}`;

  try {
    const res = await fetch(url, {
      headers: { 'x-api-key': API_KEY },
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

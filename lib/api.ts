import type {
  GachaStatus,
  StockInfo,
  PackType,
  GeneratePackResponse,
  GenerateYoloPacksResponse,
  SubmitTransactionResponse,
  OpenPackResult,
  BuybackResponse,
  BuybackCheckResult,
  Winner,
  PurchasedPack,
  GiftedPack,
  Nft,
  GeneratePurchasedPackResponse,
  GenerateGiftResponse,
} from './types';

const GACHA_BASE = '/api/gacha';

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(status: number, data: Record<string, unknown>) {
    super(
      (data?.error as string) ||
        (data?.message as string) ||
        `API error ${status}`
    );
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function fetchJson<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = path.startsWith('http') ? path : `${GACHA_BASE}/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return data as T;
}

function post<T>(path: string, body: unknown): Promise<T> {
  return fetchJson<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function get<T>(path: string): Promise<T> {
  return fetchJson<T>(path);
}

async function pollOpenPack(memo: string): Promise<OpenPackResult> {
  const TIMEOUT = 30_000;
  const INTERVAL = 500;
  const start = Date.now();

  while (Date.now() - start < TIMEOUT) {
    const res = await fetch(`${GACHA_BASE}/openPack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memo }),
    });

    const data = await res.json().catch(() => ({}));

    if (data.status === 'WAITING_FOR_WEBHOOK') {
      await new Promise((r) => setTimeout(r, INTERVAL));
      continue;
    }

    if (data.status === 'NFT_SEND_EXISTS') {
      return data as OpenPackResult;
    }

    if (!res.ok) {
      throw new ApiError(res.status, data);
    }

    return data as OpenPackResult;
  }

  throw new Error('Pack opening timed out. Please check your inventory.');
}

async function pollBuybackCheck(memo: string): Promise<BuybackCheckResult> {
  const TIMEOUT = 30_000;
  const INTERVAL = 500;
  const start = Date.now();

  while (Date.now() - start < TIMEOUT) {
    const res = await fetch(
      `${GACHA_BASE}/buyback/check?memo=${encodeURIComponent(memo)}`
    );
    const data = await res.json().catch(() => ({}));

    if (data.complete) return data as BuybackCheckResult;
    await new Promise((r) => setTimeout(r, INTERVAL));
  }

  throw new Error('Buyback check timed out.');
}

export const gachaApi = {
  getStatus: () => get<GachaStatus>('status'),

  getStock: () => get<StockInfo>('stock'),

  generatePack: (
    playerAddress: string,
    packType: PackType,
    turbo?: boolean
  ) =>
    post<GeneratePackResponse>('generatePack', {
      playerAddress,
      packType,
      ...(turbo && { turbo }),
    }),

  submitTransaction: (signedTransaction: string) =>
    post<SubmitTransactionResponse>('submitTransaction', {
      signedTransaction,
    }),

  openPack: (memo: string) => pollOpenPack(memo),

  generateYoloPacks: (
    playerAddress: string,
    packType: PackType,
    count: number
  ) =>
    post<GenerateYoloPacksResponse>('generateYoloPacks', {
      playerAddress,
      packType,
      count,
    }),

  buyback: (playerAddress: string, nftAddress: string) =>
    post<BuybackResponse>('buyback', { playerAddress, nftAddress }),

  pollBuybackCheck: (memo: string) => pollBuybackCheck(memo),

  getAllWinners: () => get<{ winners: Winner[] }>('getAllWinners'),

  getPurchasedPacks: (wallet: string) =>
    get<{ packs: PurchasedPack[] }>(
      `purchasedPacks?wallet=${encodeURIComponent(wallet)}`
    ),

  getGifted: (wallet: string) =>
    get<{ packs: GiftedPack[] }>(
      `getGifted?wallet=${encodeURIComponent(wallet)}`
    ),

  getNfts: (owner?: string) =>
    get<{ nfts: Nft[] }>(
      `getNfts${owner ? `?owner=${encodeURIComponent(owner)}` : ''}`
    ),

  generatePurchasedPack: (wallet: string) =>
    post<GeneratePurchasedPackResponse>('generatePurchasedPack', { wallet }),

  usePurchasedPack: (
    wallet: string,
    signature: string,
    nonce: string
  ) =>
    post<{ success: boolean }>('usePurchasedPack', {
      wallet,
      signature,
      nonce,
    }),

  generateGift: (
    sender: string,
    receiver: string,
    packType: PackType,
    count: number
  ) =>
    post<GenerateGiftResponse>('generateGift', {
      sender,
      receiver,
      packType,
      count,
    }),
};

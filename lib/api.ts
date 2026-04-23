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
  NftWon,
  Rarity,
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

// Derived from the rarity bands shown in VendingMachine's odds table.
// CC's winners feed has no explicit rarity field, so we bucket by
// insuredValue. $1000+ gets Legendary since the UI supports it even though
// the odds table tops out at Epic.
function insuredValueToRarity(value: number): Rarity {
  if (value >= 1000) return 'Legendary';
  if (value >= 250) return 'Epic';
  if (value >= 110) return 'Rare';
  if (value >= 60) return 'Uncommon';
  return 'Common';
}

function buildNftWon(
  raw: { nft_address: string; nft?: { name?: string; uri?: string } | null },
  rich: Nft | undefined
): NftWon {
  if (rich) {
    const md = rich.content?.metadata;
    return {
      id: rich.id,
      content: {
        files: rich.content?.files ?? [],
        links: {
          image: rich.content?.links?.image ?? '',
          external_url: rich.content?.links?.external_url,
        },
        metadata: {
          name: md?.name ?? raw.nft?.name ?? 'Unknown',
          description: md?.description,
          attributes: md?.attributes ?? [],
        },
      },
    };
  }
  return {
    id: raw.nft_address,
    content: {
      files: raw.nft?.uri ? [{ uri: raw.nft.uri }] : [],
      links: { image: '' },
      metadata: {
        name: raw.nft?.name ?? 'Unknown',
        attributes: [],
      },
    },
  };
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
  ) =>
    post<GeneratePackResponse>('generatePack', {
      playerAddress,
      packType,
    }),

  submitTransaction: (signedTransaction: string) =>
    post<SubmitTransactionResponse>('submitTransaction', {
      signedTransaction,
    }),

  openPack: (memo: string) => pollOpenPack(memo),

  generateYoloPacks: async (
    playerAddress: string,
    packType: PackType,
    count: number
  ): Promise<GenerateYoloPacksResponse> => {
    // CC returns { yoloId, count, transactions: [...] } for YOLO but the
    // original single-pull endpoint uses { packs: [...] }. Normalise so the
    // vending machine only has to understand one shape.
    const raw = await post<{
      packs?: Array<{ transaction: string; memo: string }>;
      transactions?: Array<{ transaction: string; memo: string }>;
    }>('generateYoloPacks', { playerAddress, packType, count });
    return { packs: raw.packs ?? raw.transactions ?? [] };
  },

  buyback: (playerAddress: string, nftAddress: string) =>
    post<BuybackResponse>('buyback', { playerAddress, nftAddress }),

  pollBuybackCheck: (memo: string) => pollBuybackCheck(memo),

  getAllWinners: async (): Promise<{ winners: Winner[] }> => {
    // CC's /getAllWinners returns { success, data: RawWinner[] } where each
    // RawWinner has { winner, nft_address, nft: {address,name,uri,...},
    // insuredValue, created_at, memo_slug, pack_type, prize_tier }.
    // Our UI expects the rich NftWon shape (content.files/links/metadata
    // with attributes). We join against /getNfts (the house inventory pool —
    // newly-won cards still live there since CC doesn't transfer on win) to
    // pull in the enriched metadata that the winners feed omits.
    type RawWinner = {
      winner: string;
      nft_address: string;
      nft?: { name?: string; uri?: string } | null;
      insuredValue?: number | string;
      created_at: string;
      memo_slug?: string;
      pack_type?: string;
      prize_tier?: number;
    };

    const [winnersRes, nftsRes] = await Promise.all([
      fetchJson<{ success?: boolean; data?: RawWinner[]; winners?: Winner[] }>('getAllWinners'),
      fetchJson<{ nfts?: Nft[] }>('getNfts').catch(() => ({ nfts: [] as Nft[] })),
    ]);

    // Defensive: if CC ever flips to returning the shape our client originally
    // expected (`{ winners: Winner[] }`), pass it through untouched.
    if (Array.isArray(winnersRes.winners)) {
      return { winners: winnersRes.winners };
    }

    const nftMap = new Map<string, Nft>();
    for (const n of nftsRes.nfts ?? []) nftMap.set(n.id, n);

    const winners: Winner[] = (winnersRes.data ?? []).map((r) => {
      const rich = nftMap.get(r.nft_address);
      const insured = Number(
        r.insuredValue ??
          rich?.content?.metadata?.attributes?.find(
            (a) => a.trait_type === 'Insured Value'
          )?.value ??
          0
      );
      return {
        playerAddress: r.winner,
        nft_address: r.nft_address,
        timestamp: r.created_at,
        transactionSignature: r.memo_slug ?? '',
        points: 0,
        rarity: insuredValueToRarity(insured),
        nftWon: buildNftWon(r, rich),
      };
    });

    return { winners };
  },

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

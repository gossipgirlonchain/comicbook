export type GachaStatus = {
  status: 'running' | 'stopped' | 'maintenance';
  message?: string;
};

export type StockInfo = {
  standard?: { available: number; total: number };
  legendary?: { available: number; total: number };
  [key: string]: { available: number; total: number } | undefined;
};

export type PackType = 'pokemon_50' | 'pokemon_250';

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export type NftFile = {
  uri?: string;
  cdn_uri?: string;
  cc_cdn?: string;
  mime?: string;
};

export type NftAttribute = {
  trait_type: string;
  value: string;
};

export type NftWon = {
  id: string;
  content: {
    files: NftFile[];
    links: { image: string; external_url?: string };
    metadata: {
      name: string;
      symbol?: string;
      description?: string;
      attributes: NftAttribute[];
      insuredValue?: string;
    };
  };
};

export type Nft = {
  id: string;
  content?: {
    files?: NftFile[];
    links?: { image?: string; external_url?: string };
    metadata?: {
      name?: string;
      description?: string;
      attributes?: NftAttribute[];
    };
  };
  ownership?: { owner?: string };
};

export type GeneratePackResponse = {
  transaction: string;
  memo: string;
};

export type GenerateYoloPacksResponse = {
  packs: Array<{ transaction: string; memo: string }>;
};

export type SubmitTransactionResponse = {
  success: boolean;
  signature: string;
};

export type OpenPackResult = {
  success: boolean;
  status?: string;
  transactionSignature: string;
  nft_address: string;
  nftWon: NftWon;
  points: number;
  rarity: Rarity;
};

export type BuybackResponse = {
  serializedTransaction: string;
  memo?: string;
};

export type BuybackCheckResult = {
  complete: boolean;
  signature?: string;
};

export type Winner = {
  playerAddress: string;
  nftWon: NftWon;
  rarity: Rarity;
  timestamp: string;
  transactionSignature: string;
  points: number;
  nft_address?: string;
};

export type PurchasedPack = {
  id: string;
  wallet: string;
  packType: PackType;
  status: string;
  createdAt: string;
  nftWon?: NftWon;
  rarity?: Rarity;
};

export type GiftedPack = {
  id: string;
  sender: string;
  receiver: string;
  packType: PackType;
  status: string;
  createdAt: string;
};

export type GeneratePurchasedPackResponse = {
  nonce: string;
  messageToSign: string;
  expiry: number;
};

export type GenerateGiftResponse = {
  transaction: string;
  memo: string;
};

export interface WalletAdapter {
  address: string;
  signTransaction(params: {
    transaction: Uint8Array;
  }): Promise<{ signedTransaction: Uint8Array }>;
  signMessage?(params: {
    message: Uint8Array;
  }): Promise<{ signature: Uint8Array }>;
}

export const PACK_CONFIG = {
  pokemon_50: { label: 'Standard Pack', price: 50, slug: 'standard' },
  pokemon_250: { label: 'Legendary Pack', price: 250, slug: 'legendary' },
} as const;

export const RARITY_COLORS: Record<Rarity, { bg: string; text: string; border: string; glow: string }> = {
  Common: { bg: 'bg-gray-700', text: 'text-gray-200', border: 'border-gray-500', glow: 'shadow-gray-500/30' },
  Uncommon: { bg: 'bg-emerald-700', text: 'text-emerald-200', border: 'border-emerald-400', glow: 'shadow-emerald-400/30' },
  Rare: { bg: 'bg-blue-700', text: 'text-blue-200', border: 'border-blue-400', glow: 'shadow-blue-400/40' },
  Epic: { bg: 'bg-purple-700', text: 'text-purple-200', border: 'border-purple-400', glow: 'shadow-purple-400/50' },
  Legendary: { bg: 'bg-amber-600', text: 'text-amber-100', border: 'border-amber-400', glow: 'shadow-amber-400/60' },
};

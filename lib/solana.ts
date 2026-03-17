import type { WalletAdapter } from './types';

export async function signTransaction(
  base64Tx: string,
  wallet: WalletAdapter
): Promise<string> {
  const txBytes = new Uint8Array(
    Buffer.from(base64Tx, 'base64')
  );
  const { signedTransaction } = await wallet.signTransaction({
    transaction: txBytes,
  });
  return Buffer.from(signedTransaction).toString('base64');
}

export async function signMessage(
  message: string,
  wallet: WalletAdapter
): Promise<string> {
  if (!wallet.signMessage) {
    throw new Error('Wallet does not support message signing');
  }
  const messageBytes = new TextEncoder().encode(message);
  const { signature } = await wallet.signMessage({
    message: messageBytes,
  });
  return Buffer.from(signature).toString('base64');
}

export function getNftImageUrl(
  nft: {
    content?: {
      files?: Array<{
        uri?: string;
        cdn_uri?: string;
        cc_cdn?: string;
        mime?: string;
      }>;
      links?: { image?: string };
    };
  }
): string {
  const file = nft.content?.files?.find((f) =>
    (f.mime || '').startsWith('image/')
  );
  return (
    file?.cc_cdn ||
    file?.cdn_uri ||
    file?.uri ||
    nft.content?.links?.image ||
    ''
  );
}

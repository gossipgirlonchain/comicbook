import { PublicKey, Transaction, VersionedTransaction, Connection } from '@solana/web3.js';
import type { WalletAdapter } from './types';

/**
 * Adapt a Privy Solana wallet (the `wallets[0]` from
 * `@privy-io/react-auth/solana`) to the SolanaWallet shape Coinflow's
 * CoinflowPurchase component expects.
 *
 *   Privy:   signTransaction({ transaction: Uint8Array }) -> { signedTransaction }
 *   Privy:   signMessage({ message: Uint8Array })         -> { signature }
 *   Coinflow signTransaction(tx: T)                       -> T  (T = Transaction | VersionedTransaction)
 *   Coinflow signMessage(msg: Uint8Array)                 -> Uint8Array
 *   Coinflow sendTransaction(tx: T)                       -> string (signature)
 *
 * Coinflow's onramp flow may send a transaction (e.g. to associate USDC
 * accounts) so we wire sendTransaction via the provided Connection.
 */
export function privyToCoinflowWallet(
  privyWallet: WalletAdapter,
  connection: Connection
) {
  return {
    publicKey: new PublicKey(privyWallet.address),

    signTransaction: async <T extends Transaction | VersionedTransaction>(
      tx: T
    ): Promise<T> => {
      const serialized =
        tx instanceof VersionedTransaction
          ? tx.serialize()
          : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const { signedTransaction } = await privyWallet.signTransaction({
        transaction: serialized as Uint8Array,
      });
      const bytes = new Uint8Array(signedTransaction);
      if (tx instanceof VersionedTransaction) {
        return VersionedTransaction.deserialize(bytes) as T;
      }
      return Transaction.from(bytes) as T;
    },

    sendTransaction: async <T extends Transaction | VersionedTransaction>(
      tx: T
    ): Promise<string> => {
      const serialized =
        tx instanceof VersionedTransaction
          ? tx.serialize()
          : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const { signedTransaction } = await privyWallet.signTransaction({
        transaction: serialized as Uint8Array,
      });
      const sig = await connection.sendRawTransaction(
        new Uint8Array(signedTransaction),
        { skipPreflight: false }
      );
      return sig;
    },

    signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
      if (!privyWallet.signMessage) {
        throw new Error('Wallet does not support message signing');
      }
      const { signature } = await privyWallet.signMessage({ message });
      return new Uint8Array(signature);
    },
  };
}

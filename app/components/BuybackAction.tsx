'use client';

import * as React from 'react';
import { gachaApi, ApiError } from '@/lib/api';
import { signTransaction } from '@/lib/solana';
import { markSoldBack } from '@/lib/collection';
import type { WalletAdapter } from '@/lib/types';

type Props = {
  wallet: WalletAdapter | undefined;
  nftAddress: string;
  cardName: string;
  cardImage: string;
  insuredValue: number;
  onComplete?: () => void;
  /** Visual variant. `solid` = filled accent button, `outline` = bordered. */
  variant?: 'solid' | 'outline';
  /** Override the default button label. The price is always appended. */
  label?: string;
  className?: string;
};

/**
 * Sell-back UX. Encapsulates the full flow:
 *   confirm dialog -> sign -> submit -> poll -> mark sold locally.
 *
 * On poll timeout we treat the sale as optimistically successful — the on-chain
 * tx was already signed and submitted, so the user's funds are on the way; the
 * CC webhook just hasn't caught up. This avoids the dreaded "Buyback check
 * timed out" dead-end.
 */
export default function BuybackAction({
  wallet,
  nftAddress,
  cardName,
  cardImage,
  insuredValue,
  onComplete,
  variant = 'outline',
  label,
  className = '',
}: Props) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [pendingConfirm, setPendingConfirm] = React.useState(false);

  const sellPrice = (insuredValue * 0.85).toFixed(2);

  const handleBuyback = async () => {
    if (!wallet) return;
    setBusy(true);
    setError(null);
    setPendingConfirm(false);

    try {
      const { serializedTransaction, memo } = await gachaApi.buyback(
        wallet.address,
        nftAddress
      );

      const signed = await signTransaction(serializedTransaction, wallet);
      await gachaApi.submitTransaction(signed);

      // Mark the card as sold locally immediately. The on-chain tx is in flight
      // and we don't want the card lingering in My Collection while we wait
      // for CC's webhook to confirm.
      markSoldBack(wallet.address, nftAddress);

      if (memo) {
        try {
          await gachaApi.pollBuybackCheck(memo);
        } catch (e) {
          if (
            e instanceof Error &&
            /timed out/i.test(e.message)
          ) {
            // Treat timeout as pending confirmation — the tx was submitted
            // successfully, CC just hasn't finished its webhook flow.
            setPendingConfirm(true);
            setDone(true);
            setConfirming(false);
            onComplete?.();
            return;
          }
          throw e;
        }
      }

      setDone(true);
      setConfirming(false);
      onComplete?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        // CC returns 400 with messages like "No matching NFT found within
        // the allowed time window" (72-hour buyback window) or other
        // validation failures. Surface CC's message when available.
        const msg =
          (e.data?.error as string) ||
          (e.data?.message as string) ||
          'Buyback window expired (72h).';
        setError(msg);
      } else {
        setError(e instanceof Error ? e.message : 'Buyback failed');
      }
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div
        className={`rounded-lg bg-[var(--cb-success)]/15 border border-[var(--cb-success)]/30 text-[var(--cb-success)] text-center text-xs font-semibold py-2 px-3 ${className}`}
      >
        {pendingConfirm ? 'Sale submitted — funds incoming' : 'Sold!'}
      </div>
    );
  }

  const baseClasses =
    variant === 'solid'
      ? 'bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)]'
      : 'border border-[var(--cb-accent)]/40 text-[var(--cb-accent)] hover:bg-[var(--cb-accent)]/10';

  const buttonLabel = label ?? 'Sell';

  return (
    <>
      <div className={className}>
        <button
          onClick={() => setConfirming(true)}
          disabled={busy || !wallet || !insuredValue}
          className={`w-full py-2.5 rounded-lg font-semibold text-sm disabled:opacity-40 transition-colors ${baseClasses}`}
        >
          {busy ? 'Selling…' : `${buttonLabel} $${sellPrice}`}
        </button>
        {error && (
          <p className="text-xs text-[var(--cb-error)] mt-1">{error}</p>
        )}
      </div>

      {confirming && (
        <SellConfirmDialog
          cardName={cardName}
          cardImage={cardImage}
          insuredValue={insuredValue}
          sellPrice={sellPrice}
          busy={busy}
          error={error}
          onCancel={() => {
            if (busy) return;
            setConfirming(false);
            setError(null);
          }}
          onConfirm={handleBuyback}
        />
      )}
    </>
  );
}

function SellConfirmDialog({
  cardName,
  cardImage,
  insuredValue,
  sellPrice,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  cardName: string;
  cardImage: string;
  insuredValue: number;
  sellPrice: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 overlay-enter"
      style={{ background: 'rgba(8, 13, 26, 0.92)' }}
      onClick={onCancel}
    >
      <div
        className="relative max-w-sm w-full rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-6 space-y-4 reveal-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg bg-[var(--cb-bg)] flex-shrink-0 overflow-hidden border border-[var(--cb-border)]">
            {cardImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cardImage}
                alt={cardName}
                className="w-full h-full object-contain p-1"
              />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold truncate">Sell back to house?</h3>
            <p className="text-xs text-[var(--cb-text-muted)] truncate mt-0.5">
              {cardName}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--cb-border)] bg-[var(--cb-bg)] p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--cb-text-muted)]">Insured value</span>
            <span className="font-semibold">${insuredValue.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--cb-text-muted)]">Buyback rate</span>
            <span className="font-semibold">85%</span>
          </div>
          <div className="h-px bg-[var(--cb-border)]" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--cb-text-muted)]">
              You receive
            </span>
            <span className="text-xl font-bold text-[var(--cb-success)]">
              ${sellPrice}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-[var(--cb-text-muted)] leading-snug">
          The card will be returned to the house and cannot be recovered.
          Funds arrive in your wallet once the transaction confirms (usually
          within a minute).
        </p>

        {error && (
          <p className="text-xs text-[var(--cb-error)] bg-[var(--cb-error)]/10 border border-[var(--cb-error)]/30 rounded-lg p-2">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg border border-[var(--cb-border)] text-sm font-semibold text-[var(--cb-text-muted)] hover:text-[var(--cb-text)] hover:bg-[var(--cb-surface-hover)] transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2.5 rounded-lg bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? (
              <>
                <span
                  className="spinner"
                  style={{ width: 14, height: 14, borderWidth: 2 }}
                />
                Selling…
              </>
            ) : (
              `Confirm Sell $${sellPrice}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Helper: pull the Insured Value attr off an NFT. */
export function getInsuredValueFromAttrs(
  attributes: Array<{ trait_type: string; value: string }> | undefined
): number {
  const attr = attributes?.find((a) => a.trait_type === 'Insured Value');
  return attr ? parseFloat(attr.value) || 0 : 0;
}

'use client';

import * as React from 'react';
import { gachaApi } from '@/lib/api';
import { getNftImageUrl } from '@/lib/solana';
import type { Winner } from '@/lib/types';
import { RARITY_COLORS } from '@/lib/types';

export default function WinnersFeed() {
  const [winners, setWinners] = React.useState<Winner[]>([]);

  React.useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const { winners: w } = await gachaApi.getAllWinners();
        if (alive) setWinners(w ?? []);
      } catch {
        /* feed is non-critical */
      }
    };

    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!winners.length) return null;

  const doubled = [...winners, ...winners];

  return (
    <div className="w-full overflow-hidden">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="inline-block w-2 h-2 rounded-full bg-[var(--cb-success)] pulse-dot" />
        <h3 className="text-xs font-semibold text-[var(--cb-accent)] uppercase tracking-wider">
          Recent Wins
        </h3>
      </div>

      <div
        className="ticker-track"
        style={{
          '--ticker-duration': `${Math.max(20, winners.length * 4)}s`,
        } as React.CSSProperties}
      >
        {doubled.map((winner, i) => {
          const isHighlight =
            winner.rarity === 'Epic' || winner.rarity === 'Legendary';
          const colors =
            RARITY_COLORS[winner.rarity] || RARITY_COLORS.Common;

          return (
            <div
              key={`${winner.transactionSignature}-${i}`}
              className={`flex-shrink-0 flex items-center gap-3 px-4 py-2.5 mr-3 rounded-xl border transition-colors ${
                isHighlight
                  ? 'gold-border bg-[var(--cb-accent)]/5'
                  : 'border-[var(--cb-border)] bg-[var(--cb-surface)]'
              }`}
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-[var(--cb-bg)] flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getNftImageUrl(winner.nftWon)}
                  alt=""
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-semibold truncate max-w-[140px]">
                  {winner.nftWon.content.metadata.name}
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                  >
                    {winner.rarity}
                  </span>
                  <span className="text-xs text-[var(--cb-text-muted)]">
                    {winner.playerAddress.slice(0, 4)}...
                    {winner.playerAddress.slice(-4)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import PrivyConnect from '@/app/components/PrivyConnect';
import NftGallery from '@/app/components/NftGallery';
import { gachaApi } from '@/lib/api';
import type { Winner, MachinePull } from '@/lib/types';

const NETWORK = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
const EXPLORER_CLUSTER =
  NETWORK === 'mainnet-beta' ? '' : `?cluster=${NETWORK}`;

type PullStatus = 'revealed' | 'pending' | 'failed';

type EnrichedPull = MachinePull & {
  status: PullStatus;
  winner?: Winner;
};

export default function InventoryPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const wallet = wallets?.[0];

  const [tab, setTab] = React.useState<'collection' | 'pulls'>('collection');
  const [pulls, setPulls] = React.useState<EnrichedPull[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [pullsError, setPullsError] = React.useState<string | null>(null);
  const [refreshKey] = React.useState(0);

  React.useEffect(() => {
    if (!wallet?.address) return;
    let alive = true;

    const load = async () => {
      setLoading(true);
      setPullsError(null);
      try {
        const [pullsRes, winnersRes] = await Promise.all([
          fetch(
            `/api/machinePulls?address=${encodeURIComponent(wallet.address)}`,
            { cache: 'no-store' }
          ).then(async (r) => {
            const data = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
            return data as { pulls: MachinePull[] };
          }),
          gachaApi.getAllWinners().catch((e) => {
            console.error('[inventory] getAllWinners failed:', e);
            return { winners: [] as Winner[] };
          }),
        ]);
        if (!alive) return;

        const winnersByMemo = new Map<string, Winner>();
        for (const w of winnersRes.winners) {
          if (
            w.playerAddress === wallet.address &&
            w.transactionSignature
          ) {
            winnersByMemo.set(w.transactionSignature, w);
          }
        }

        const enriched: EnrichedPull[] = pullsRes.pulls.map((p) => {
          const winner = winnersByMemo.get(p.memo);
          const status: PullStatus = winner
            ? 'revealed'
            : p.hasError
              ? 'failed'
              : 'pending';
          return { ...p, status, winner };
        });

        setPulls(enriched);
      } catch (e) {
        console.error('[inventory] load pulls failed:', e);
        if (alive)
          setPullsError(
            e instanceof Error ? e.message : 'Failed to load machine pulls'
          );
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [wallet?.address, refreshKey]);

  const tabs = [
    { id: 'collection' as const, label: 'Collection' },
    { id: 'pulls' as const, label: 'Machine Pulls' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-8">
        {!ready ? (
          <div className="flex justify-center py-20">
            <div className="spinner spinner-lg" />
          </div>
        ) : !authenticated ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-[var(--cb-text-muted)]">
              Connect your wallet to view your inventory.
            </p>
            <PrivyConnect />
          </div>
        ) : (
          <>
            <div className="flex gap-1 mb-6 p-1 rounded-xl bg-[var(--cb-bg)] border border-[var(--cb-border)] w-fit">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-[var(--cb-accent)] text-[var(--cb-accent-text)] font-bold shadow-sm'
                      : 'text-[var(--cb-text-muted)] hover:text-[var(--cb-text)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'collection' && (
              <NftGallery owner={wallet?.address} key={refreshKey} />
            )}

            {tab === 'pulls' && (
              <PullsList
                loading={loading}
                error={pullsError}
                pulls={pulls}
              />
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

function PullsList({
  loading,
  error,
  pulls,
}: {
  loading: boolean;
  error: string | null;
  pulls: EnrichedPull[];
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner spinner-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--cb-error)]/30 bg-[var(--cb-error)]/10 p-4 text-sm text-[var(--cb-error)]">
        Could not load machine pulls: {error}
      </div>
    );
  }

  if (pulls.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--cb-text-muted)]">
        <p className="text-lg font-semibold">No machine pulls yet</p>
        <p className="text-sm mt-1">
          <Link
            href="/"
            className="text-[var(--cb-accent)] hover:underline"
          >
            Pull the machine
          </Link>{' '}
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pulls.map((p) => (
        <PullRow key={p.memo} pull={p} />
      ))}
    </div>
  );
}

function PullRow({ pull }: { pull: EnrichedPull }) {
  const date = pull.firstBlockTime
    ? new Date(pull.firstBlockTime * 1000)
    : null;
  const explorerUrl = `https://explorer.solana.com/tx/${pull.firstSignature}${EXPLORER_CLUSTER}`;

  const statusChip = (() => {
    if (pull.status === 'revealed') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--cb-success)]/20 text-[var(--cb-success)] font-semibold">
          Revealed
        </span>
      );
    }
    if (pull.status === 'failed') {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--cb-error)]/20 text-[var(--cb-error)] font-semibold">
          On-chain failed
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--cb-warning)]/20 text-[var(--cb-warning)] font-semibold">
        Pending reveal
      </span>
    );
  })();

  const body = (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-3 hover:bg-[var(--cb-surface-hover)] transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold truncate">
            {pull.winner?.nftWon.content.metadata.name ?? 'Pull'}
          </span>
          {statusChip}
        </div>
        <div className="text-xs text-[var(--cb-text-muted)] mt-0.5 flex items-center gap-2 flex-wrap">
          <span>{date ? date.toLocaleString() : 'Unknown time'}</span>
          <span className="text-[var(--cb-border)]">·</span>
          <span className="font-mono">
            {pull.memo.slice(0, 11)}…{pull.memo.slice(-4)}
          </span>
          <span className="text-[var(--cb-border)]">·</span>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--cb-accent)] hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View tx
          </a>
        </div>
      </div>
    </div>
  );

  if (pull.winner) {
    const mint = pull.winner.nft_address ?? pull.winner.nftWon.id;
    return (
      <Link href={`/cards/${mint}`} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

'use client';

import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID || '';

export default function Providers({ children }: { children: React.ReactNode }) {
  if (!appId || !clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-4 rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-8">
          <h2 className="text-xl font-bold">Configuration Required</h2>
          <p className="text-[var(--cb-text-muted)] text-sm">
            Set <code className="text-[var(--cb-accent)]">NEXT_PUBLIC_PRIVY_APP_ID</code> and{' '}
            <code className="text-[var(--cb-accent)]">NEXT_PUBLIC_PRIVY_CLIENT_ID</code> in your{' '}
            <code>.env.local</code> file to enable wallet authentication.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        loginMethods: ['google', 'wallet', 'email'],
        appearance: {
          walletChainType: 'ethereum-and-solana',
          theme: 'dark',
          accentColor: '#ffb91d',
        },
        embeddedWallets: {
          solana: { createOnLogin: 'users-without-wallets' },
          showWalletUIs: false,
        },
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors() },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

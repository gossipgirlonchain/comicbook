'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import PrivyConnect from '@/app/components/PrivyConnect';

export default function Header() {
  const pathname = usePathname();
  const { authenticated } = usePrivy();

  const navLinks = [
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/', label: 'Gacha' },
    ...(authenticated ? [{ href: '/inventory', label: 'Inventory' }] : []),
  ];

  return (
    <header className="border-b border-[var(--cb-border)] bg-[var(--cb-primary)] sticky top-0 z-40">
      <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cb-logo-white.png"
              alt="ComicBook.com"
              className="h-10 w-auto"
            />
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const active =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <PrivyConnect />
      </div>
    </header>
  );
}

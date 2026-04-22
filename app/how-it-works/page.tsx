import Link from 'next/link';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';

export const metadata = {
  title: 'How It Works - ComicBook.com Gacha',
  description:
    'Real, graded collectibles in a vending machine. Choose your pull, open your pack, keep it or sell it back for 85% of its value.',
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[860px] mx-auto w-full px-4 py-12">
        <div className="space-y-12">
          {/* Hero */}
          <section className="text-center space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold">How It Works</h1>
            <p className="text-lg text-[var(--cb-text-muted)] max-w-xl mx-auto">
              Real, graded collectibles in a vending machine you can use from
              your phone.
            </p>
          </section>

          {/* Steps — copy direct from Andrew */}
          <section className="space-y-6">
            <Step
              number="01"
              title="Choose your pull"
              body="Standard, Rare, or Legendary — each tier contains higher-value cards. The machine is stocked by our team with authenticated, curated items from local shops."
            />
            <Step
              number="02"
              title="Open it and see what you got"
              body="Watch the live reveal and find out exactly what's inside your pack, and what it's worth."
            />
            <Step
              number="03"
              title="Keep it, trade it, or sell it back"
              body="Love your pull? It's yours. Not feeling it? Sell it back within 24 hours for 85% of its value, instantly. No listing fees, no waiting for a buyer."
            />
          </section>

          {/* CTA */}
          <section className="rounded-2xl border border-[var(--cb-accent)]/30 bg-[var(--cb-accent)]/5 p-8 text-center space-y-4">
            <h3 className="text-2xl font-bold">Ready to try your luck?</h3>
            <Link
              href="/"
              className="inline-block px-8 py-3 rounded-xl bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] font-bold transition-colors"
            >
              Pull the Machine
            </Link>
          </section>
        </div>
      </main>

      <Footer
        marginTop="mt-12"
        links={[{ href: '/terms', label: 'Terms' }]}
      />
    </div>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-5 p-5 rounded-2xl border border-[var(--cb-border)] bg-[var(--cb-surface)]">
      <div className="flex-shrink-0 text-4xl font-bold text-[var(--cb-accent)]/30 tabular-nums">
        {number}
      </div>
      <div className="space-y-1.5">
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="text-sm text-[var(--cb-text-muted)]">{body}</p>
      </div>
    </div>
  );
}

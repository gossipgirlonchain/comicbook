import Link from 'next/link';
import Header from '@/app/components/Header';

export const metadata = {
  title: 'How It Works - ComicBook.com Gacha',
  description:
    'Learn how the ComicBook.com Gacha Machine works - open packs, collect real cards, cash out instantly.',
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

          {/* TODO: Replace with final copy from ComicBook.com team */}
          <section className="rounded-2xl border border-[var(--cb-warning)]/30 bg-[var(--cb-warning)]/5 p-4 text-xs text-[var(--cb-text-muted)]">
            <strong className="text-[var(--cb-warning)]">Placeholder copy:</strong>{' '}
            final wording pending from the ComicBook.com team.
          </section>

          {/* Steps */}
          <section className="space-y-6">
            <Step
              number="01"
              title="Pick a pack tier"
              body="Starter, Standard, or Legendary - each tier contains higher-value cards. Every card is a real, graded collectible authenticated and insured."
            />
            <Step
              number="02"
              title="Pay with card or transfer"
              body="Buy with Apple Pay, Google Pay, or debit card. No ID required for most purchases. Funds arrive in your ComicBook.com balance in seconds."
            />
            <Step
              number="03"
              title="Open your pack"
              body="Open one pack, or go big and open 3, 5, 10, or 20 at once. Watch the reveal animation and see exactly what you pulled."
            />
            <Step
              number="04"
              title="Keep the card or sell it back"
              body="Love it? It lives in your collection. Want cash? Sell it back to the house for 85% of its insured value - instantly, no listings, no waiting."
            />
            <Step
              number="05"
              title="Track your collection"
              body="Your profile shows everything you've pulled, your stats by rarity, your wins, and where you rank on the leaderboard."
            />
          </section>

          {/* FAQ */}
          <section className="space-y-5">
            <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>

            <Faq
              q="Are the cards real?"
              a="Yes. Every card is a real, professionally graded collectible that ComicBook.com has authenticated and insured. You're not buying a digital image - you're buying the physical asset."
            />
            <Faq
              q="How do I get my card?"
              a="Cards live in your ComicBook.com collection until you decide what to do with them. You can keep them, sell them back to the house, or - TODO - redeem the physical card."
            />
            <Faq
              q="What does 'sell back to the house' mean?"
              a="At any time you can sell a card you own back to ComicBook.com for 85% of its insured value. The payout hits your balance instantly. No peer-to-peer marketplace, no listings, no waiting for a buyer."
            />
            <Faq
              q="Is there a minimum age?"
              a="You must be 18 or older to open packs. TODO: final age requirement from legal team."
            />
            <Faq
              q="Is this gambling?"
              a="TODO: language from legal team."
            />
            <Faq
              q="What's the odds breakdown?"
              a="Every pack shows its rarity odds before you buy. TODO: final odds breakdown from CollectorCrypt team."
            />
          </section>

          {/* CTA */}
          <section className="rounded-2xl border border-[var(--cb-accent)]/30 bg-[var(--cb-accent)]/5 p-8 text-center space-y-4">
            <h3 className="text-2xl font-bold">Ready to try your luck?</h3>
            <Link
              href="/"
              className="inline-block px-8 py-3 rounded-xl bg-[var(--cb-accent)] hover:bg-[var(--cb-accent-hover)] text-[var(--cb-accent-text)] font-bold transition-colors"
            >
              Open the Machine
            </Link>
          </section>
        </div>
      </main>

      <footer className="border-t border-[var(--cb-border)] bg-[var(--cb-surface)]/50 py-6 mt-12">
        <div className="max-w-[1400px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--cb-text-muted)]">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cb-bug-yellow.png" alt="" className="w-5 h-5" />
            <span>&copy; {new Date().getFullYear()} ComicBook.com</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[var(--cb-text)] transition-colors">
              Terms
            </Link>
            <span>Powered by CollectorCrypt</span>
          </div>
        </div>
      </footer>
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

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group rounded-xl border border-[var(--cb-border)] bg-[var(--cb-surface)] p-4">
      <summary className="cursor-pointer font-semibold text-[var(--cb-text)] list-none flex items-center justify-between">
        <span>{q}</span>
        <svg
          className="w-4 h-4 text-[var(--cb-text-muted)] group-open:rotate-180 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <p className="mt-3 text-sm text-[var(--cb-text-muted)]">{a}</p>
    </details>
  );
}

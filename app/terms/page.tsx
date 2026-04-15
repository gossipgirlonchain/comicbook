import Link from 'next/link';
import Header from '@/app/components/Header';

export const metadata = {
  title: 'Terms & Conditions - ComicBook.com Gacha',
  description: 'Terms & Conditions for the ComicBook.com Gacha Machine.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 max-w-[800px] mx-auto w-full px-4 py-12">
        <article className="space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Terms &amp; Conditions</h1>
            <p className="text-sm text-[var(--cb-text-muted)]">
              Last updated: TODO - insert date
            </p>
          </div>

          {/* Placeholder warning */}
          <div className="rounded-2xl border border-[var(--cb-warning)]/30 bg-[var(--cb-warning)]/5 p-4">
            <p className="text-sm text-[var(--cb-warning)] font-semibold">
              Placeholder copy
            </p>
            <p className="text-xs text-[var(--cb-text-muted)] mt-1">
              The content below is lorem ipsum and MUST be replaced with final
              legal copy from the ComicBook.com legal team before launch.
            </p>
          </div>

          <Section title="1. Acceptance of Terms">
            <p>
              TODO: By accessing or using the ComicBook.com Gacha service, you
              agree to be bound by these Terms &amp; Conditions. If you do not
              agree, do not use the service.
            </p>
          </Section>

          <Section title="2. Eligibility">
            <p>
              TODO: You must be at least 18 years of age (or the legal age of
              majority in your jurisdiction, whichever is higher) to use this
              service. You represent that you are not located in a jurisdiction
              where use of this service is prohibited.
            </p>
          </Section>

          <Section title="3. Digital Collectibles">
            <p>
              TODO: Cards obtained through the Gacha Machine are real, graded
              collectibles that have been authenticated and insured by
              ComicBook.com and/or its partners. TODO: describe custody,
              redemption, shipping, and physical delivery terms.
            </p>
          </Section>

          <Section title="4. Purchases and Payments">
            <p>
              TODO: All pack purchases are final. Pack contents are determined
              at random according to the published odds. Payment is processed
              via TODO - payment provider. No refunds on opened packs.
            </p>
          </Section>

          <Section title="5. Sell-Back Program">
            <p>
              TODO: You may sell eligible cards back to ComicBook.com for a
              percentage of their stated insured value (currently 85%). The
              sell-back offer is available for a limited window after pack
              opening and may be modified or discontinued at any time.
            </p>
          </Section>

          <Section title="6. Odds and Probabilities">
            <p>
              TODO: Each pack tier publishes its rarity distribution. These
              probabilities are enforced by ComicBook.com&apos;s partner provider
              CollectorCrypt and are subject to audit.
            </p>
          </Section>

          <Section title="7. Account and Security">
            <p>
              TODO: You are responsible for maintaining the security of your
              account credentials. ComicBook.com is not liable for losses
              resulting from unauthorized access to your account.
            </p>
          </Section>

          <Section title="8. Prohibited Conduct">
            <p>
              TODO: You may not use the service for money laundering, fraud,
              market manipulation, or any illegal activity. ComicBook.com
              reserves the right to suspend or terminate accounts that violate
              these terms.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              TODO: ComicBook.com provides the service &quot;as is&quot; and disclaims all
              warranties to the maximum extent permitted by law.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              TODO: These terms are governed by the laws of TODO - jurisdiction,
              without regard to its conflict of laws principles.
            </p>
          </Section>

          <Section title="11. Changes to Terms">
            <p>
              TODO: We may update these Terms &amp; Conditions from time to time.
              Continued use of the service after changes constitutes acceptance
              of the updated terms.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              TODO: For questions about these terms, contact TODO - email
              address.
            </p>
          </Section>
        </article>
      </main>

      <footer className="border-t border-[var(--cb-border)] bg-[var(--cb-surface)]/50 py-6 mt-12">
        <div className="max-w-[1400px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--cb-text-muted)]">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/cb-bug-yellow.png" alt="" className="w-5 h-5" />
            <span>&copy; {new Date().getFullYear()} ComicBook.com</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/how-it-works" className="hover:text-[var(--cb-text)] transition-colors">
              How It Works
            </Link>
            <span>Powered by CollectorCrypt</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="text-sm text-[var(--cb-text-muted)] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

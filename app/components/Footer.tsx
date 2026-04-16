import Link from 'next/link';
import CollectorLogo from './CollectorLogo';

type Props = {
  /** Optional extra links rendered to the left of the Powered by mark. */
  links?: Array<{ href: string; label: string }>;
  /** Override top margin. Default is `mt-auto` so the footer sticks to the bottom. */
  marginTop?: string;
};

export default function Footer({ links, marginTop = 'mt-auto' }: Props) {
  return (
    <footer
      className={`border-t border-[var(--cb-border)] bg-[var(--cb-surface)]/50 py-6 ${marginTop}`}
    >
      <div className="max-w-[1400px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--cb-text-muted)]">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cb-bug-yellow.png" alt="" className="w-5 h-5" />
          <span>&copy; {new Date().getFullYear()} ComicBook.com</span>
        </div>
        <div className="flex items-center gap-4">
          {links?.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-[var(--cb-text)] transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <span className="flex items-center gap-1.5 text-[var(--cb-text-muted)]">
            <span>Powered by</span>
            <CollectorLogo className="h-3 w-auto" />
          </span>
        </div>
      </div>
    </footer>
  );
}

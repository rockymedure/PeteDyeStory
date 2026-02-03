'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

function formatDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  return `${month}.${day}.${year}`;
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={[
        'px-2.5 py-1 rounded-full font-mono text-[10px] tracking-widest uppercase transition-colors sm:px-3 sm:py-1.5',
        isActive
          ? 'bg-[var(--amber)]/15 text-[var(--amber)] border border-[var(--amber)]/25'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-visible)]',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

export default function AppHeader({
  left,
  status = 'Archive',
  maxWidthClass = 'max-w-6xl',
}: {
  left?: ReactNode;
  status?: string;
  maxWidthClass?: string;
}) {
  const pathname = usePathname();
  const isOutline = pathname.startsWith('/outline');
  const indicatorColor = 'var(--rec-red)';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[var(--bg-deep)]/80 border-b border-[var(--border-subtle)]">
      <div className={`${maxWidthClass} mx-auto px-6 h-14 flex items-center justify-between`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="rec-indicator" style={{ ['--indicator-color' as never]: indicatorColor }}>
            <span>{status}</span>
          </div>
          {left ?? (
            <>
              <span
                className={[
                  'font-mono text-xs tracking-widest uppercase',
                  isOutline ? 'text-[var(--amber)]' : 'text-[var(--text-muted)]',
                ].join(' ')}
              >
                {isOutline ? 'Outline' : 'Pete Dye'}
              </span>
              <span className="w-px h-4 bg-[var(--border-visible)]" />
              <span className="font-mono text-[10px] tracking-wider text-[var(--text-muted)]">
                {formatDate()}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="flex items-center gap-1 sm:gap-2">
            <NavLink href="/">Clips</NavLink>
            <NavLink href="/outline">Outline</NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}


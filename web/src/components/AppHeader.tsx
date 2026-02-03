'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

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
  maxWidthClass = 'max-w-6xl',
}: {
  left?: ReactNode;
  maxWidthClass?: string;
}) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[var(--bg-deep)]/80 border-b border-[var(--border-subtle)]">
      <div className={`${maxWidthClass} mx-auto px-6 h-14 flex items-center justify-between`}>
        <div className="flex items-center gap-3 min-w-0">
          {left ?? (
            <span className="font-mono text-xs tracking-widest uppercase text-[var(--text-muted)]">
              Pete Dye Golf Club Project
            </span>
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


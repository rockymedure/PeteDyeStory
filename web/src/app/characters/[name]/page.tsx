import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import characterProfiles from '@/data/characterProfiles.json';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Quote {
  text: string;
  timestamp: string;
  context: string;
}

interface Appearance {
  video: string;
  role: string;
  is_speaking: boolean;
  description: string;
  quotes: Quote[];
}

interface Character {
  name: string;
  appearances: Appearance[];
  total_videos: number;
  total_quotes: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function humanizeVideoName(dirName: string): string {
  return dirName
    .replace(/_/g, ' ')
    .replace(/-(\d)/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ─── Static params ─────────────────────────────────────────────────────── */

const characters = characterProfiles as Character[];

export function generateStaticParams() {
  return characters.map((c) => ({
    name: c.name,
  }));
}

/* ─── Metadata ──────────────────────────────────────────────────────────── */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ name: string }>;
}): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const character = characters.find((c) => c.name === decoded);

  if (!character) {
    return { title: 'Character Not Found — Pete Dye Project' };
  }

  return {
    title: `${character.name} — Pete Dye Project`,
    description: `${character.name} appears in ${character.total_videos} videos with ${character.total_quotes} quotes in the Pete Dye documentary archive.`,
  };
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const character = characters.find((c) => c.name === decoded);

  if (!character) notFound();

  const totalAppearances = character.appearances.length;

  return (
    <main className="min-h-screen relative">
      <AppHeader
        left={
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/characters"
              className="font-mono text-[9px] sm:text-xs tracking-widest uppercase text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              Characters
            </Link>
            <span className="text-[var(--text-muted)] text-xs shrink-0">/</span>
            <span className="font-mono text-[9px] sm:text-xs tracking-widest uppercase text-[var(--text-primary)] truncate">
              {character.name}
            </span>
          </div>
        }
      />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-8 px-5 sm:pt-32 sm:pb-12 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-slide-up">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--amber)] uppercase mb-4 sm:mb-6">
              Character Profile
            </p>

            <h1 className="text-3xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-[var(--text-primary)] mb-6 leading-[1.1]">
              {character.name}
            </h1>
          </div>

          {/* Stats row */}
          <div
            className="flex flex-wrap items-center gap-4 sm:gap-8 animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-xl sm:text-2xl font-medium text-[var(--text-primary)]">
                {character.total_videos}
              </span>
              <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider">
                Videos
              </span>
            </div>
            <span className="w-px h-5 sm:h-6 bg-[var(--border-visible)]" />
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-xl sm:text-2xl font-medium text-[var(--text-primary)]">
                {character.total_quotes}
              </span>
              <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider">
                Quotes
              </span>
            </div>
            <span className="w-px h-5 sm:h-6 bg-[var(--border-visible)]" />
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-xl sm:text-2xl font-medium text-[var(--text-primary)]">
                {totalAppearances}
              </span>
              <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider">
                Appearances
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Appearances ───────────────────────────────────────────────── */}
      <section className="px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-2xl font-semibold text-[var(--text-primary)] shrink-0">
              Appearances
            </h2>
            <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] shrink-0">
              {totalAppearances} video{totalAppearances !== 1 ? 's' : ''}
            </span>
            <span className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <div className="space-y-6 sm:space-y-8 stagger-children">
            {character.appearances.map((appearance, idx) => (
              <article key={idx} className="card p-5 sm:p-6">
                {/* Video name + speaking badge */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <Link
                    href={`/videos/${appearance.video}`}
                    className="group inline-block min-w-0"
                  >
                    <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] leading-snug group-hover:text-[var(--amber)] transition-colors">
                      {humanizeVideoName(appearance.video)}
                    </h3>
                  </Link>
                  {appearance.is_speaking && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--amber)]/10 border border-[var(--amber)]/20 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                      <span className="font-mono text-[9px] text-[var(--amber)] tracking-wider uppercase">
                        Speaking
                      </span>
                    </span>
                  )}
                </div>

                {/* Role */}
                <p className="font-mono text-[10px] sm:text-[11px] text-[var(--text-muted)] tracking-wider uppercase mb-3">
                  {appearance.role}
                </p>

                {/* Description */}
                {appearance.description && (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                    {appearance.description}
                  </p>
                )}

                {/* Quotes */}
                {appearance.quotes.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {appearance.quotes.map((quote, qi) => (
                      <blockquote
                        key={qi}
                        className="border-l-2 border-[var(--amber)]/25 pl-4 sm:pl-5"
                      >
                        <p className="text-sm text-[var(--text-secondary)] italic leading-relaxed">
                          &ldquo;{quote.text}&rdquo;
                        </p>
                        <footer className="mt-2 flex items-center gap-3">
                          <span className="timecode">{quote.timestamp}</span>
                          {quote.context && (
                            <span className="text-[11px] text-[var(--text-muted)] line-clamp-1">
                              {quote.context}
                            </span>
                          )}
                        </footer>
                      </blockquote>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-subtle)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <span className="font-mono text-[9px] sm:text-[10px] text-[var(--text-muted)] tracking-wider">
            PETE DYE GOLF CLUB — CLARKSBURG, WV
          </span>
          <span className="font-mono text-[9px] sm:text-[10px] text-[var(--text-muted)]">
            ◉ {character.total_videos} VIDEOS
          </span>
        </div>
      </footer>
    </main>
  );
}

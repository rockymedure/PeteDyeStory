import type { Metadata } from 'next';
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
    .replace(/\s+/g, ' ')
    .replace(/-(\d{3})$/, '') // strip trailing -009 style suffixes
    .trim();
}

/* ─── Constants ─────────────────────────────────────────────────────────── */

const FEATURED_NAMES = ['Pete Dye', 'James D. LaRosa', 'Jimmy LaRosa', 'Louie Ellis'];

/* ─── Metadata ──────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Characters — Pete Dye Project',
  description:
    'Every person captured across decades of archival footage from the Pete Dye Golf Club construction.',
};

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function CharactersPage() {
  const characters = characterProfiles as Character[];

  // Sort by quote count descending
  const sorted = [...characters].sort(
    (a, b) => (b.total_quotes ?? 0) - (a.total_quotes ?? 0),
  );

  // Featured characters (in the order specified)
  const featured = FEATURED_NAMES.map((name) =>
    sorted.find((c) => c.name === name),
  ).filter(Boolean) as Character[];

  // All other characters for the grid (excluding featured)
  const others = sorted.filter((c) => !FEATURED_NAMES.includes(c.name));

  // Top 12 for detailed profiles
  const detailedProfiles = sorted.slice(0, 12);

  // Aggregate stats
  const totalCharacters = characters.length;
  const totalQuotes = characters.reduce((s, c) => s + (c.total_quotes ?? 0), 0);
  const totalAppearances = characters.reduce(
    (s, c) => s + (c.total_videos ?? 0),
    0,
  );
  const uniqueVideos = new Set(
    characters.flatMap((c) => c.appearances.map((a) => a.video)),
  ).size;

  return (
    <main className="min-h-screen relative">
      <AppHeader />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-8 px-5 sm:pt-32 sm:pb-12 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-slide-up">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--amber)] uppercase mb-4 sm:mb-6">
              Characters
            </p>

            <h1 className="text-3xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-[var(--text-primary)] mb-4 sm:mb-6 leading-[1.1]">
              The people who<br />
              built the dream.
            </h1>

            <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl leading-relaxed">
              {totalCharacters} people across {uniqueVideos} videos of archival
              footage — miners, designers, friends, and family captured on tape.
            </p>
          </div>

          {/* Stats row */}
          <div
            className="mt-8 sm:mt-12 flex flex-wrap items-center gap-4 sm:gap-8 animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-xl sm:text-2xl font-medium text-[var(--text-primary)]">
                {totalCharacters}
              </span>
              <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider">
                Characters
              </span>
            </div>
            <span className="w-px h-5 sm:h-6 bg-[var(--border-visible)]" />
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-xl sm:text-2xl font-medium text-[var(--text-primary)]">
                {totalQuotes}
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
                Video Appearances
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Characters ───────────────────────────────────────── */}
      <section className="px-5 pb-12 sm:px-6 sm:pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-2xl font-semibold text-[var(--text-primary)] shrink-0">
              Key Figures
            </h2>
            <span className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <div className="space-y-4 sm:space-y-5 stagger-children">
            {featured.map((character) => {
              const firstQuote = character.appearances
                .flatMap((a) => a.quotes)
                .find((q) => q.text.length > 40);
              const primaryRole =
                character.appearances[0]?.role ?? 'Unknown role';

              return (
                <article
                  key={character.name}
                  className="card p-5 sm:p-7 md:p-8 border-l-2 border-l-[var(--amber)]/40"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6 mb-4">
                    <div className="min-w-0">
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-semibold text-[var(--text-primary)] mb-1">
                        {character.name}
                      </h3>
                      <p className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] tracking-wider uppercase">
                        {primaryRole}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--amber)]/10 border border-[var(--amber)]/20">
                        <span className="font-mono text-xs font-medium text-[var(--amber)]">
                          {character.total_videos}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--amber)]/70">
                          videos
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                        <span className="font-mono text-xs font-medium text-[var(--text-primary)]">
                          {character.total_quotes}
                        </span>
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          quotes
                        </span>
                      </span>
                    </div>
                  </div>

                  {firstQuote && (
                    <blockquote className="border-l-2 border-[var(--amber)]/25 pl-4 sm:pl-5 mt-4">
                      <p className="text-sm sm:text-base text-[var(--text-secondary)] italic leading-relaxed line-clamp-3">
                        &ldquo;{firstQuote.text}&rdquo;
                      </p>
                      {firstQuote.context && (
                        <cite className="block mt-2 font-mono text-[10px] text-[var(--text-muted)] not-italic tracking-wider uppercase">
                          {firstQuote.context}
                        </cite>
                      )}
                    </blockquote>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Character Grid ────────────────────────────────────────────── */}
      <section className="px-5 pb-12 sm:px-6 sm:pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-2xl font-semibold text-[var(--text-primary)] shrink-0">
              All Characters
            </h2>
            <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] shrink-0">
              {others.length} people
            </span>
            <span className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 stagger-children">
            {others.map((character) => {
              const primaryRole =
                character.appearances[0]?.role ?? 'Unknown role';

              return (
                <div
                  key={character.name}
                  className="card p-4 sm:p-5 flex flex-col justify-between gap-3"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] mb-1 truncate">
                      {character.name}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                      {primaryRole}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--amber)]/8 border border-[var(--amber)]/15">
                      <span className="font-mono text-[10px] font-medium text-[var(--amber)]">
                        {character.total_videos}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--amber)]/60">
                        vid
                      </span>
                    </span>
                    {character.total_quotes > 0 && (
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        {character.total_quotes} quotes
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Detailed Profiles ─────────────────────────────────────────── */}
      <section className="px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 sm:gap-4 mb-8 sm:mb-12">
            <h2 className="text-lg sm:text-2xl font-semibold text-[var(--text-primary)] shrink-0">
              Profiles
            </h2>
            <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] shrink-0">
              Top 12 by appearances
            </span>
            <span className="flex-1 h-px bg-[var(--border-subtle)]" />
          </div>

          <div className="space-y-12 sm:space-y-16">
            {detailedProfiles.map((character) => {
              // Collect up to 3 quotes across all appearances
              const allQuotes = character.appearances.flatMap((a) => a.quotes);
              const displayQuotes = allQuotes.slice(0, 3);

              return (
                <article
                  key={character.name}
                  className="relative"
                >
                  {/* Name & subtitle */}
                  <div className="mb-5 sm:mb-6">
                    <h3 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-[var(--text-primary)] mb-1">
                      {character.name}
                    </h3>
                    <p className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] tracking-[0.2em] uppercase">
                      Appears in {character.total_videos} video
                      {character.total_videos !== 1 ? 's' : ''}
                      {character.total_quotes > 0 && (
                        <> · {character.total_quotes} quote{character.total_quotes !== 1 ? 's' : ''}</>
                      )}
                    </p>
                  </div>

                  {/* Appearances list */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-6">
                    {character.appearances.map((appearance, idx) => (
                      <div
                        key={idx}
                        className="card p-4 sm:p-5"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h4 className="text-sm sm:text-base font-medium text-[var(--text-primary)] line-clamp-2 leading-snug">
                            {humanizeVideoName(appearance.video)}
                          </h4>
                          {appearance.is_speaking && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--amber)]/10 border border-[var(--amber)]/20 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                              <span className="font-mono text-[9px] text-[var(--amber)] tracking-wider uppercase">
                                Speaking
                              </span>
                            </span>
                          )}
                        </div>
                        <p className="font-mono text-[10px] sm:text-[11px] text-[var(--text-muted)] tracking-wider uppercase mb-2">
                          {appearance.role}
                        </p>
                        {appearance.description && (
                          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">
                            {appearance.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Quotes */}
                  {displayQuotes.length > 0 && (
                    <div className="space-y-4">
                      {displayQuotes.map((quote, qi) => (
                        <blockquote
                          key={qi}
                          className="border-l-2 border-[var(--amber)]/25 pl-4 sm:pl-5"
                        >
                          <p className="text-sm sm:text-base text-[var(--text-secondary)] italic leading-relaxed">
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

                  {/* Divider */}
                  <div className="mt-10 sm:mt-14 h-px bg-[var(--border-subtle)]" />
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-subtle)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <span className="font-mono text-[9px] sm:text-[10px] text-[var(--text-muted)] tracking-wider">
            PETE DYE GOLF CLUB — CLARKSBURG, WV
          </span>
          <span className="font-mono text-[9px] sm:text-[10px] text-[var(--text-muted)]">
            ◉ {totalCharacters} PEOPLE ON TAPE
          </span>
        </div>
      </footer>
    </main>
  );
}

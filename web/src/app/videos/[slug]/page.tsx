import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import videoAnalyses from '@/data/videoAnalyses.json';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface VideoAnalysis {
  title: string;
  content_type: string;
  summary: string;
  characters: { name: string; role: string; description: string; is_speaking: boolean }[];
  chapters: { title: string; start_time: string; end_time: string; summary: string; characters_present: string[] }[];
  highlights: { title: string; timestamp: string; description: string; emotional_tone: string; characters_involved: string[] }[];
  quotes: { text: string; speaker: string; timestamp: string; context: string }[];
  themes: string[];
}

const analyses = videoAnalyses as Record<string, VideoAnalysis>;

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function humanizeSlug(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/-/g, ' ');
}

function emotionColor(tone: string): {
  bg: string;
  text: string;
  border: string;
} {
  const t = tone.toLowerCase();
  if (t.includes('proud') || t.includes('triumphant') || t.includes('celebratory') || t.includes('warm')) {
    return {
      bg: 'bg-[var(--amber)]/10',
      text: 'text-[var(--amber)]',
      border: 'border-[var(--amber)]/20',
    };
  }
  if (t.includes('reflective') || t.includes('nostalgic') || t.includes('contemplative') || t.includes('reverent')) {
    return {
      bg: 'bg-[var(--tape-blue)]/10',
      text: 'text-[var(--tape-blue)]',
      border: 'border-[var(--tape-blue)]/20',
    };
  }
  if (t.includes('emotional') || t.includes('somber') || t.includes('poignant') || t.includes('bittersweet')) {
    return {
      bg: 'bg-[var(--rec-red)]/10',
      text: 'text-[var(--rec-red)]',
      border: 'border-[var(--rec-red)]/20',
    };
  }
  // Default: muted neutral
  return {
    bg: 'bg-[var(--bg-elevated)]',
    text: 'text-[var(--text-secondary)]',
    border: 'border-[var(--border-subtle)]',
  };
}

/* ─── Static params ─────────────────────────────────────────────────────── */

export function generateStaticParams() {
  return Object.keys(analyses).map((key) => ({ slug: key }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  // Next.js 15+ async params — but for generateMetadata we can use the sync helper:
  // We'll wrap in an async function
  return params.then(({ slug }) => {
    const analysis = analyses[slug];
    const title = analysis?.title || humanizeSlug(slug);
    return {
      title: `${title} — Pete Dye Project`,
      description: analysis?.summary?.slice(0, 160) || `Video analysis for ${title}`,
    };
  });
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const analysis = analyses[slug];
  if (!analysis) notFound();

  const { title, content_type, summary, characters, chapters, highlights, quotes, themes } = analysis;

  return (
    <main className="min-h-screen relative">
      {/* Header with breadcrumb */}
      <AppHeader
        left={
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/"
              className="font-mono text-[9px] sm:text-xs tracking-widest uppercase text-[var(--text-muted)] hover:text-[var(--amber)] transition-colors shrink-0"
            >
              ← Clips
            </Link>
            <span className="text-[var(--border-visible)] shrink-0">/</span>
            <span className="font-mono text-[9px] sm:text-xs tracking-widest uppercase text-[var(--text-secondary)] truncate">
              {title.length > 50 ? title.slice(0, 50) + '…' : title}
            </span>
          </div>
        }
      />

      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <section className="pt-24 pb-8 px-5 sm:pt-32 sm:pb-12 sm:px-6">
        <div className="max-w-4xl mx-auto animate-slide-up">
          {/* Content type badge */}
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--amber)]/10 text-[var(--amber)] font-mono text-[9px] sm:text-[10px] tracking-wider uppercase border border-[var(--amber)]/20 mb-4 sm:mb-5">
            {content_type}
          </span>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-[var(--text-primary)] mb-4 sm:mb-6 leading-[1.15]">
            {title}
          </h1>

          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-3xl">
            {summary}
          </p>

          {/* Quick stats */}
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-4 sm:gap-6">
            {characters.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg sm:text-xl font-medium text-[var(--text-primary)]">{characters.length}</span>
                <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Characters</span>
              </div>
            )}
            {chapters.length > 0 && (
              <>
                <span className="w-px h-5 bg-[var(--border-visible)]" />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg sm:text-xl font-medium text-[var(--text-primary)]">{chapters.length}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Chapters</span>
                </div>
              </>
            )}
            {quotes.length > 0 && (
              <>
                <span className="w-px h-5 bg-[var(--border-visible)]" />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg sm:text-xl font-medium text-[var(--text-primary)]">{quotes.length}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Quotes</span>
                </div>
              </>
            )}
            {highlights.length > 0 && (
              <>
                <span className="w-px h-5 bg-[var(--border-visible)]" />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg sm:text-xl font-medium text-[var(--text-primary)]">{highlights.length}</span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Highlights</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-5 sm:px-6 pb-16 sm:pb-24 space-y-10 sm:space-y-12">

        {/* ── Characters (compact inline) ─────────────────────────────── */}
        {characters.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] shrink-0">Characters</h2>
              <span className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>

            <div className="flex flex-wrap gap-2">
              {characters.map((char) => (
                <span
                  key={char.name}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs sm:text-sm"
                >
                  {char.is_speaking && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--amber)]" />
                  )}
                  <span className="text-[var(--text-primary)] font-medium">{char.name}</span>
                  <span className="text-[var(--text-muted)] font-mono text-[9px] uppercase tracking-wider hidden sm:inline">{char.role.split(/[,;]/)[0].trim()}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Chapters (the core content) ─────────────────────────────── */}
        {chapters.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] shrink-0">Chapters</h2>
              <span className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>

            <div className="space-y-0.5">
              {chapters.map((ch, i) => (
                <div
                  key={`${ch.start_time}-${i}`}
                  className="group relative flex gap-3 sm:gap-4 px-3 py-3 sm:px-4 sm:py-4 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
                >
                  <div className="flex flex-col items-center shrink-0 pt-0.5">
                    <span className="timecode text-[10px] sm:text-xs whitespace-nowrap tabular-nums">
                      {ch.start_time}
                    </span>
                    {i < chapters.length - 1 && (
                      <span className="w-px flex-1 bg-[var(--border-subtle)] mt-1.5 min-h-[0.5rem]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] leading-snug">
                      {ch.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1 line-clamp-2">
                      {ch.summary}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Key Quotes (top 5 only) ─────────────────────────────────── */}
        {quotes.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] shrink-0">Key Quotes</h2>
              <span className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>

            <div className="space-y-4">
              {quotes.slice(0, 5).map((q, i) => (
                <blockquote
                  key={`${q.timestamp}-${i}`}
                  className="relative pl-4 border-l-2 border-[var(--amber)]/30"
                >
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed italic">
                    &ldquo;{q.text}&rdquo;
                  </p>
                  <footer className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-medium text-[var(--amber)]">{q.speaker}</span>
                    <span className="timecode text-[10px]">{q.timestamp}</span>
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>
        )}

        {/* ── Themes (compact tags) ───────────────────────────────────── */}
        {themes.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] shrink-0">Themes</h2>
              <span className="flex-1 h-px bg-[var(--border-subtle)]" />
            </div>

            <div className="flex flex-wrap gap-2">
              {themes.map((theme) => (
                <span
                  key={theme}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs border border-[var(--border-subtle)]"
                >
                  {theme}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-subtle)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <span className="font-mono text-[9px] sm:text-[10px] text-[var(--text-muted)] tracking-wider">
            PETE DYE GOLF CLUB — CLARKSBURG, WV
          </span>
          <span className="font-mono text-[9px] sm:text-[10px] text-[var(--text-muted)]">
            ◉ 1995
          </span>
        </div>
      </footer>
    </main>
  );
}

import type { Metadata } from 'next';
import AppHeader from '@/components/AppHeader';
import timelineEvents from '@/data/timeline.json';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface TimelineEvent {
  date_estimate: string;
  title: string;
  video: string;
  chapter: string | null;
  start_time: string;
  end_time: string | null;
  summary: string;
  characters: string[];
}

interface YearGroup {
  year: string;
  events: TimelineEvent[];
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function humanizeVideoName(dirName: string): string {
  return dirName
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/-(\d{3})$/, '') // strip trailing -009 style suffixes
    .trim();
}

function groupByYear(events: TimelineEvent[]): YearGroup[] {
  const map = new Map<string, TimelineEvent[]>();
  for (const event of events) {
    const year = event.date_estimate;
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(event);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, evts]) => ({ year, events: evts }));
}

function getYearGap(prevYear: string, currYear: string): number {
  const prev = parseInt(prevYear, 10);
  const curr = parseInt(currYear, 10);
  if (isNaN(prev) || isNaN(curr)) return 0;
  return curr - prev;
}

/* ─── Metadata ──────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Timeline — Pete Dye Project',
  description:
    'The story of the Pete Dye Golf Club from 1978 to 2004, assembled from archival footage.',
};

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function TimelinePage() {
  const events = timelineEvents as TimelineEvent[];
  const yearGroups = groupByYear(events);

  const firstYear = yearGroups[0]?.year ?? '1982';
  const lastYear = yearGroups[yearGroups.length - 1]?.year ?? '2004';

  return (
    <main className="min-h-screen relative">
      <AppHeader />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-8 px-5 sm:pt-32 sm:pb-12 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="animate-slide-up">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--amber)] uppercase mb-4 sm:mb-6">
              Timeline
            </p>

            <h1 className="text-3xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-[var(--text-primary)] mb-4 sm:mb-6 leading-[1.1]">
              {firstYear}&thinsp;–&thinsp;{lastYear}
            </h1>

            <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl leading-relaxed">
              The story from {firstYear} to {lastYear}, assembled from archival
              footage. {events.length} documented moments across{' '}
              {yearGroups.length} years of construction and celebration.
            </p>
          </div>

          {/* Year jump links */}
          <div
            className="mt-8 sm:mt-10 flex flex-wrap items-center gap-2 animate-fade-in"
            style={{ animationDelay: '200ms' }}
          >
            {yearGroups.map(({ year, events: evts }) => (
              <a
                key={year}
                href={`#year-${year}`}
                className="px-2.5 py-1 rounded-full font-mono text-[10px] tracking-widest uppercase border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--amber)] hover:border-[var(--amber)]/30 transition-colors"
              >
                {year}
                <span className="ml-1 opacity-50">
                  ({evts.length})
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ──────────────────────────────────────────────────── */}
      <section className="px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="max-w-5xl mx-auto">
          {/*
            Layout geometry (all values from container border edge):
            ─────────────────────────────────────────────────
            Mobile: padding-left 40px, line center at 16px
            Desktop (md+): padding-left 56px, line center at 24px
            ─────────────────────────────────────────────────
            Year dot:   centered on line, absolutely from content edge
            Event dot:  centered on line, absolutely from content edge
          */}
          <div className="relative pl-10 md:pl-14">
            {/* The amber timeline line */}
            <div className="absolute left-[15px] md:left-[23px] top-0 bottom-0 w-[2px] bg-[var(--amber)]/15" />

            {yearGroups.map(({ year, events: yearEvents }, groupIdx) => {
              const prevYear =
                groupIdx > 0 ? yearGroups[groupIdx - 1].year : null;
              const gap = prevYear ? getYearGap(prevYear, year) : 0;

              return (
                <div key={year}>
                  {/* ── Gap indicator ─────────────────────────────── */}
                  {gap > 1 && (
                    <div className="py-8 sm:py-10">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="h-px flex-1 border-t border-dashed border-[var(--border-visible)]" />
                        <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-[0.2em] uppercase shrink-0 px-1">
                          No footage · {prevYear}–{year}
                        </span>
                        <div className="h-px flex-1 border-t border-dashed border-[var(--border-visible)]" />
                      </div>
                    </div>
                  )}

                  {/* ── Year group ────────────────────────────────── */}
                  <div
                    id={`year-${year}`}
                    className="relative pb-10 md:pb-14 scroll-mt-16"
                  >
                    {/* Year marker dot — centered on timeline line */}
                    <div className="absolute left-[-40px] md:left-[-56px] top-0 w-8 h-8 md:w-12 md:h-12 rounded-full bg-[var(--bg-deep)] border-2 border-[var(--amber)] flex items-center justify-center z-[5]">
                      <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full bg-[var(--amber)] shadow-[0_0_12px_rgba(232,168,60,0.4)]" />
                    </div>

                    {/* Year header — sticky below AppHeader */}
                    <div className="sticky top-12 sm:top-14 z-10 bg-[var(--bg-deep)]/95 backdrop-blur-sm -ml-10 md:-ml-14 pl-10 md:pl-14 py-3 mb-5 sm:mb-6">
                      <div className="flex items-center gap-4 sm:gap-5">
                        <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-[var(--amber)] tabular-nums">
                          {year}
                        </h2>
                        <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] tracking-[0.2em] uppercase">
                          {yearEvents.length} event
                          {yearEvents.length !== 1 ? 's' : ''}
                        </span>
                        <span className="flex-1 h-px bg-[var(--border-subtle)]" />
                      </div>
                    </div>

                    {/* Events */}
                    <div className="space-y-4 sm:space-y-5 stagger-children">
                      {yearEvents.map((event, eventIdx) => (
                        <div key={eventIdx} className="relative">
                          {/* Small event dot on the timeline line */}
                          <div className="absolute left-[-28px] md:left-[-37px] top-5 w-2 h-2 md:w-2.5 md:h-2.5 rounded-full bg-[var(--amber)]/30 border border-[var(--amber)]/20" />

                          {/* Event card */}
                          <div className="card p-4 sm:p-5 md:p-6">
                            <h3 className="text-sm sm:text-base md:text-lg font-semibold text-[var(--text-primary)] mb-2 leading-snug">
                              {event.title}
                            </h3>

                            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-3 sm:mb-4 line-clamp-3">
                              {event.summary}
                            </p>

                            {/* Character tags */}
                            {event.characters.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {event.characters.map((char) => (
                                  <span
                                    key={char}
                                    className="inline-block px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono text-[9px] sm:text-[10px] text-[var(--text-secondary)] tracking-wider"
                                  >
                                    {char}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Source video & timecode */}
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-[11px] sm:text-xs text-[var(--text-muted)] truncate max-w-[260px] sm:max-w-none">
                                {humanizeVideoName(event.video)}
                              </span>
                              {event.start_time && (
                                <span className="timecode">
                                  {event.start_time}
                                  {event.end_time &&
                                    ` → ${event.end_time}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Terminal dot at the bottom of the line */}
            <div className="absolute left-[10px] md:left-[16px] bottom-[-6px] w-3 h-3 md:w-4 md:h-4 rounded-full bg-[var(--amber)]/40 border border-[var(--amber)]/30" />
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-subtle)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <span className="font-mono text-[9px] sm:text-[10px] text-[var(--text-muted)] tracking-wider">
            PETE DYE GOLF CLUB — CLARKSBURG, WV
          </span>
          <span className="font-mono text-[9px] sm:text-[10px] text-[var(--text-muted)]">
            ◉ {firstYear}–{lastYear}
          </span>
        </div>
      </footer>
    </main>
  );
}

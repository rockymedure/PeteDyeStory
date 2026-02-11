import { supabase } from '@/lib/supabase';
import { unstable_cache } from 'next/cache';
import type { Clip } from '@/lib/types';
import Link from 'next/link';
import TapePlayer from '@/components/TapePlayer';
import AppHeader from '@/components/AppHeader';
import videoAnalyses from '@/data/videoAnalyses.json';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Video {
  id: string;
  filename: string;
  title: string | null;
  summary: string | null;
}

interface ClipWithVideo extends Clip {
  video?: { filename: string };
}

interface VideoWithClips extends Video {
  clips: ClipWithVideo[];
}

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

/* ─── Analysis lookup ───────────────────────────────────────────────────── */

const analyses = videoAnalyses as Record<string, VideoAnalysis>;

function getAnalysisWithKey(video: Video): { analysis: VideoAnalysis; key: string } | null {
  const dirName = (video.filename || '')
    .replace(/\.mp4$/i, '')
    .replace(/[^\w\-]/g, '_')
    .replace(/_+/g, '_');

  if (analyses[dirName]) return { analysis: analyses[dirName], key: dirName };

  for (const [key, val] of Object.entries(analyses)) {
    if (
      key.toLowerCase().includes(dirName.toLowerCase().slice(0, 20)) ||
      dirName.toLowerCase().includes(key.toLowerCase().slice(0, 20))
    ) {
      return { analysis: val, key };
    }
  }
  return null;
}

function getAnalysis(video: Video): VideoAnalysis | null {
  return getAnalysisWithKey(video)?.analysis ?? null;
}

function getSlug(video: Video): string {
  // Use the actual analysis key (which matches pre-rendered pages) when available
  const match = getAnalysisWithKey(video);
  if (match) return match.key;
  // Fallback for videos without analysis
  return (video.filename || '')
    .replace(/\.mp4$/i, '')
    .replace(/[^\w\-]/g, '_')
    .replace(/_+/g, '_');
}

/* ─── Aggregate stats from all analyses ─────────────────────────────────── */

const allCharacterNames = new Set<string>();
let totalQuotes = 0;
for (const a of Object.values(analyses)) {
  for (const c of a.characters ?? []) allCharacterNames.add(c.name);
  totalQuotes += (a.quotes ?? []).length;
}
const totalCharacters = allCharacterNames.size;

/* ─── Category logic (analysis-enriched) ────────────────────────────────── */

// Videos where Pete Dye is confirmed on camera or speaking
const PETE_DYE_ON_CAMERA_KEYWORDS = [
  'construction highlights',
  'pete dye interview',
  'pete dye & james d',
  'louie ellis documentary',
  'grand opening',
  'front nine opening',
  'first green planting',
];

function featuresPeteDye(video: Video): boolean {
  const title = (video.title || video.filename).toLowerCase();
  return PETE_DYE_ON_CAMERA_KEYWORDS.some(kw => title.includes(kw));
}

function getCategoryFromAnalysis(contentType: string): string | null {
  const ct = contentType.toLowerCase();
  if (ct.includes('construction')) return 'Building the Course';
  if (ct.includes('interview')) return 'People & Relationships';
  if (ct.includes('ceremony') || ct.includes('opening') || ct.includes('grand') || ct.includes('award') || ct.includes('banquet')) return 'Celebrations & Milestones';
  if (ct.includes('tournament') || ct.includes('broadcast')) return 'The Legacy';
  if (ct.includes('party') || ct.includes('dinner') || ct.includes('family') || ct.includes('social') || ct.includes('gathering')) return 'Family & Friends';
  if (ct.includes('narrated') || ct.includes('promotional') || ct.includes('promo') || ct.includes('overview') || ct.includes('featurette')) return 'The Legacy';
  return null;
}

function getCategoryFallback(video: Video): string {
  const title = (video.title || video.filename).toLowerCase();

  if (
    title.includes('construction') || title.includes('cleanup') ||
    title.includes('planting') || title.includes('progress') ||
    title.includes('holes 1-9') || title.includes('irrigation') ||
    title.includes('early years') || title.includes('course tour') ||
    title.includes('louie ellis documentary') ||
    (title.includes('spring 1989') && !title.includes('opening'))
  ) return 'Building the Course';

  if (
    title.includes('opening') || title.includes('grand') ||
    title.includes('citizen of the year') || title.includes('award')
  ) return 'Celebrations & Milestones';

  if (
    title.includes('classic') || title.includes('nationwide') ||
    title.includes('tour') || title.includes('cbs') ||
    title.includes('narrated') || title.includes('documentary') ||
    title.includes('harris holt')
  ) return 'The Legacy';

  if (
    title.includes('interview') || title.includes('dimaggio') ||
    title.includes('christmas') || title.includes('dinner') ||
    title.includes('party') || title.includes('papa jim')
  ) return 'People & Relationships';

  if (
    title.includes('family') || title.includes('halloween') ||
    title.includes('holidays') || title.includes('archives') ||
    title.includes('historic')
  ) return 'Family Archives';

  return 'Archive';
}

function getCategory(video: Video): string {
  const analysis = getAnalysis(video);
  if (analysis) {
    const cat = getCategoryFromAnalysis(analysis.content_type);
    if (cat) return cat;
  }
  return getCategoryFallback(video);
}

/* ─── Supabase fetch (unchanged) ────────────────────────────────────────── */

const getVideosWithClips = unstable_cache(
  async () => {
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .order('title');

    if (videosError) throw videosError;

    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('*, videos(filename)')
      .order('filename');

    if (clipsError) throw clipsError;

    const videosWithClips: VideoWithClips[] = (videos as Video[])
      .map(video => {
        const videoClips = (clips as (ClipWithVideo & { videos: { filename: string } | null })[])
          .filter(c => c.video_id === video.id)
          .map(c => ({
            ...c,
            video: c.videos ? { filename: c.videos.filename } : undefined
          }));

        return { ...video, clips: videoClips };
      })
      .filter(v => v.clips.length > 0);

    return videosWithClips;
  },
  ['videos-with-clips'],
  { revalidate: 60 }
);

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default async function Home() {
  const videosWithClips = await getVideosWithClips();
  const totalClips = videosWithClips.reduce((sum, v) => sum + v.clips.length, 0);

  // Group videos by category
  const categories: Record<string, VideoWithClips[]> = {};
  for (const video of videosWithClips) {
    if (featuresPeteDye(video)) {
      if (!categories['Featuring Pete Dye']) categories['Featuring Pete Dye'] = [];
      categories['Featuring Pete Dye'].push(video);
    }
    const cat = getCategory(video);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(video);
  }

  const categoryOrder = [
    'Featuring Pete Dye',
    'Building the Course',
    'Celebrations & Milestones',
    'People & Relationships',
    'The Legacy',
    'Family & Friends',
    'Family Archives',
    'Archive',
  ];
  const orderedCategories = categoryOrder.filter(cat => categories[cat]?.length > 0);

  return (
    <main className="min-h-screen relative">
      <AppHeader />

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-12 px-5 sm:pt-32 sm:pb-16 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-slide-up">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--amber)] uppercase mb-4 sm:mb-6">
              Video Archive
            </p>

            <h1 className="text-3xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-[var(--text-primary)] mb-4 sm:mb-6 leading-[1.1]">
              He designed over 100<br />
              legendary courses.<br />
              <span className="text-[var(--text-muted)]">He put his name on one.</span>
            </h1>

            <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-xl leading-relaxed">
              Carved from an abandoned coal mine in West Virginia, alongside two miners
              who spent 18 years refusing to quit.
            </p>
          </div>

        </div>
      </section>

      {/* ── Categories ──────────────────────────────────────────────────── */}
      {(() => {
        // Build a flat ordered list of all tapes for cross-tape navigation
        const allTapes = orderedCategories.flatMap((cat) =>
          (categories[cat] ?? []).map((video) => ({
            videoId: video.id,
            title: getAnalysis(video)?.title || video.title || video.filename.replace(/_/g, ' '),
            clips: video.clips,
          }))
        );
        // Deduplicate (videos can appear in multiple categories like "Featuring Pete Dye")
        const seen = new Set<string>();
        const uniqueTapes = allTapes.filter((t) => {
          if (seen.has(t.videoId)) return false;
          seen.add(t.videoId);
          return true;
        });

        return (
      <section className="px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="max-w-6xl mx-auto space-y-10 sm:space-y-16">
          {orderedCategories.map((categoryName) => {
            const categoryVideos = categories[categoryName];
            const categoryClipCount = categoryVideos.reduce((sum, v) => sum + v.clips.length, 0);

            return (
              <div key={categoryName}>
                {/* Category header */}
                <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-8">
                  <h2 className="text-lg sm:text-2xl font-semibold text-[var(--text-primary)] shrink-0">
                    {categoryName}
                  </h2>
                  <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] shrink-0">
                    {categoryClipCount} clips
                  </span>
                  <span className="flex-1 h-px bg-[var(--border-subtle)]" />
                </div>

                {/* Videos in category */}
                <div className="space-y-5 sm:space-y-8">
                  {categoryVideos.map((video) => {
                    const analysis = getAnalysis(video);
                    const slug = getSlug(video);
                    const displayTitle = analysis?.title || video.title || video.filename.replace(/_/g, ' ');
                    const displaySummary = analysis?.summary || video.summary;
                    const characters = analysis?.characters?.slice(0, 4) ?? [];
                    const quoteCount = analysis?.quotes?.length ?? 0;
                    const chapterCount = analysis?.chapters?.length ?? 0;

                    return (
                      <article key={video.id} className="card overflow-hidden">
                        <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-5">
                          {/* Title row */}
                          <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 mb-2 sm:mb-3">
                            <div className="min-w-0 flex-1">
                              {analysis ? (
                                <Link
                                  href={`/videos/${slug}`}
                                  className="group inline-flex items-baseline gap-2 min-w-0"
                                >
                                  <h3 className="text-base sm:text-xl font-semibold text-[var(--text-primary)] line-clamp-2 sm:truncate group-hover:text-[var(--amber)] transition-colors">
                                    {displayTitle}
                                  </h3>
                                </Link>
                              ) : (
                                <h3 className="text-base sm:text-xl font-semibold text-[var(--text-primary)] line-clamp-2 sm:truncate">
                                  {displayTitle}
                                </h3>
                              )}
                            </div>
                            <span className="font-mono text-[10px] text-[var(--text-muted)] whitespace-nowrap mt-1 sm:mt-0">
                              {video.clips.length} clips
                            </span>
                          </div>

                          {/* Content type badge + meta row */}
                          <div className="flex flex-wrap items-center gap-2 mb-2.5 sm:mb-3">
                            {analysis?.content_type && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[var(--amber)]/10 text-[var(--amber)] font-mono text-[9px] sm:text-[10px] tracking-wider uppercase border border-[var(--amber)]/20 leading-tight">
                                {analysis.content_type.length > 40
                                  ? analysis.content_type.slice(0, 40) + '…'
                                  : analysis.content_type}
                              </span>
                            )}
                          </div>

                          {/* Character tags */}
                          {characters.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2.5 sm:mb-3">
                              {characters.map((char) => (
                                <span
                                  key={char.name}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-mono text-[9px] sm:text-[10px] border border-[var(--border-subtle)] leading-tight"
                                >
                                  {char.is_speaking && (
                                    <span className="w-1 h-1 rounded-full bg-[var(--amber)] shrink-0" />
                                  )}
                                  {char.name}
                                </span>
                              ))}
                              {(analysis?.characters?.length ?? 0) > 4 && (
                                <span className="font-mono text-[9px] text-[var(--text-muted)] self-center">
                                  +{(analysis?.characters?.length ?? 0) - 4} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Summary */}
                          {displaySummary && (
                            <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2 sm:line-clamp-3">
                              {displaySummary}
                            </p>
                          )}
                        </div>

                        <TapePlayer
                          tapes={uniqueTapes}
                          tapeIndex={uniqueTapes.findIndex((t) => t.videoId === video.id)}
                        />
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
        );
      })()}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-subtle)] px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
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

import { supabase } from '@/lib/supabase';
import { unstable_cache } from 'next/cache';
import type { Clip } from '@/lib/types';
import ClipCarousel from '@/components/ClipCarousel';
import AppHeader from '@/components/AppHeader';

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

// Videos where Pete Dye is confirmed on camera or speaking
// (based on AI analysis CHARACTERS sections from transcripts)
const PETE_DYE_ON_CAMERA_KEYWORDS = [
  'construction highlights',    // "Pete Dye: central figure in the video"
  'pete dye interview',         // direct interview
  'pete dye & james d',         // on site together
  'louie ellis documentary',    // documentary with Pete Dye interviews
  'grand opening',              // speeches honoring Pete and Alice Dye
  'front nine opening',         // Pete at ceremony
  'first green planting',       // Pete involved in construction
];

function featuresPeteDye(video: Video): boolean {
  const title = (video.title || video.filename).toLowerCase();
  return PETE_DYE_ON_CAMERA_KEYWORDS.some(kw => title.includes(kw));
}

// Content-based categories
function getCategory(video: Video): string {
  const title = (video.title || video.filename).toLowerCase();
  
  // Building the Course — Construction footage, behind-the-scenes docs
  if (
    title.includes('construction') ||
    title.includes('cleanup') ||
    title.includes('planting') ||
    title.includes('progress') ||
    title.includes('holes 1-9') ||
    title.includes('irrigation') ||
    title.includes('early years') ||
    title.includes('course tour') ||
    title.includes('louie ellis documentary') ||
    (title.includes('spring 1989') && !title.includes('opening'))
  ) {
    return 'Building the Course';
  }
  
  // Celebrations & Milestones — Openings, awards
  if (
    title.includes('opening') ||
    title.includes('grand') ||
    title.includes('citizen of the year') ||
    title.includes('award')
  ) {
    return 'Celebrations & Milestones';
  }
  
  // The Legacy — Tournaments, documentaries, media
  if (
    title.includes('classic') ||
    title.includes('nationwide') ||
    title.includes('tour') ||
    title.includes('cbs') ||
    title.includes('narrated') ||
    title.includes('documentary') ||
    title.includes('harris holt')
  ) {
    return 'The Legacy';
  }
  
  // People & Relationships — Interviews, gatherings, guests
  if (
    title.includes('interview') ||
    title.includes('dimaggio') ||
    title.includes('christmas') ||
    title.includes('dinner') ||
    title.includes('party') ||
    title.includes('papa jim')
  ) {
    return 'People & Relationships';
  }
  
  // Family Archives — Personal footage, historic, family holidays
  if (
    title.includes('family') ||
    title.includes('halloween') ||
    title.includes('holidays') ||
    title.includes('archives') ||
    title.includes('historic')
  ) {
    return 'Family Archives';
  }
  
  return 'Archive';
}

const getVideosWithClips = unstable_cache(
  async () => {
    // Get all videos
    const { data: videos, error: videosError } = await supabase
      .from('videos')
      .select('*')
      .order('title');
    
    if (videosError) throw videosError;

    // Get all clips with video info
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('*, videos(filename)')
      .order('filename');
    
    if (clipsError) throw clipsError;

    // Group clips by video
    const videosWithClips: VideoWithClips[] = (videos as Video[])
      .map(video => {
        const videoClips = (clips as (ClipWithVideo & { videos: { filename: string } | null })[])
          .filter(c => c.video_id === video.id)
          .map(c => ({
            ...c,
            video: c.videos ? { filename: c.videos.filename } : undefined
          }));
        
        return {
          ...video,
          clips: videoClips
        };
      })
      .filter(v => v.clips.length > 0); // Only show videos that have clips

    return videosWithClips;
  },
  ['videos-with-clips'],
  { revalidate: 60 }
);

export default async function Home() {
  const videosWithClips = await getVideosWithClips();
  const totalClips = videosWithClips.reduce((sum, v) => sum + v.clips.length, 0);

  // Group videos by category
  // Videos featuring Pete Dye on camera get their own section AND stay in their content category
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

  // Order categories — Pete Dye first
  const categoryOrder = ['Featuring Pete Dye', 'Building the Course', 'Celebrations & Milestones', 'People & Relationships', 'The Legacy', 'Family Archives', 'Archive'];
  const orderedCategories = categoryOrder.filter(cat => categories[cat]?.length > 0);

  return (
    <main className="min-h-screen relative">
      <AppHeader />

      {/* Hero */}
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
          
          <div className="mt-8 sm:mt-12 flex flex-wrap items-center gap-4 sm:gap-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-xl sm:text-2xl font-medium text-[var(--text-primary)]">{totalClips}</span>
              <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider">Clips</span>
            </div>
            <span className="w-px h-5 sm:h-6 bg-[var(--border-visible)]" />
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-xl sm:text-2xl font-medium text-[var(--text-primary)]">{videosWithClips.length}</span>
              <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider">Tapes</span>
            </div>
            <span className="w-px h-5 sm:h-6 bg-[var(--border-visible)]" />
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-mono text-xl sm:text-2xl font-medium text-[var(--text-primary)]">{orderedCategories.length}</span>
              <span className="font-mono text-[10px] sm:text-xs text-[var(--text-muted)] uppercase tracking-wider">Categories</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
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
                  {categoryVideos.map((video) => (
                    <article key={video.id} className="card overflow-hidden">
                      <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-5">
                        <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 mb-1 sm:mb-2">
                          <h3 className="text-base sm:text-xl font-semibold text-[var(--text-primary)] line-clamp-2 sm:truncate">
                            {video.title || video.filename.replace(/_/g, ' ')}
                          </h3>
                          <span className="font-mono text-[10px] text-[var(--text-muted)] whitespace-nowrap mt-1 sm:mt-0">
                            {video.clips.length} clips
                          </span>
                        </div>
                        {video.summary && (
                          <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)] line-clamp-2 sm:line-clamp-3">
                            {video.summary}
                          </p>
                        )}
                      </div>

                      <ClipCarousel clips={video.clips} />
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
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

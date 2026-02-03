import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import type { Clip } from '@/lib/types';
import ClipCarousel from '@/components/ClipCarousel';

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

// Categorize videos into broader themes
function getCategory(video: Video): string {
  const title = (video.title || video.filename).toLowerCase();
  
  if (title.includes('construction') || title.includes('cleaning') || title.includes('thru')) {
    return 'Construction';
  }
  if (title.includes('interview') || title.includes('pete dye') && !title.includes('classic')) {
    return 'Pete Dye';
  }
  if (title.includes('classic') || title.includes('tour') || title.includes('nationwide')) {
    return 'Tournaments';
  }
  if (title.includes('opening') || title.includes('grand') || title.includes('award') || title.includes('ceremony')) {
    return 'Milestones';
  }
  if (title.includes('christmas') || title.includes('party') || title.includes('dinner') || title.includes('guest')) {
    return 'Gatherings';
  }
  if (title.includes('narrated') || title.includes('highlights') || title.includes('promo')) {
    return 'Documentary';
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

function formatDate() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  return `${month}.${day}.${year}`;
}

export default async function Home() {
  const videosWithClips = await getVideosWithClips();
  const totalClips = videosWithClips.reduce((sum, v) => sum + v.clips.length, 0);

  // Group videos by category
  const categories: Record<string, VideoWithClips[]> = {};
  for (const video of videosWithClips) {
    const cat = getCategory(video);
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(video);
  }

  // Order categories
  const categoryOrder = ['Pete Dye', 'Construction', 'Milestones', 'Tournaments', 'Documentary', 'Gatherings', 'Archive'];
  const orderedCategories = categoryOrder.filter(cat => categories[cat]?.length > 0);

  return (
    <main className="min-h-screen relative">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[var(--bg-deep)]/80 border-b border-[var(--border-subtle)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs tracking-widest text-[var(--text-muted)] uppercase">
              Pete Dye
            </span>
            <span className="w-px h-4 bg-[var(--border-visible)]" />
            <span className="font-mono text-[10px] tracking-wider text-[var(--text-muted)]">
              {formatDate()}
            </span>
          </div>
          <div className="rec-indicator">
            <span>Archive</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-slide-up">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--amber)] uppercase mb-6">
              Video Archive
            </p>
            
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-[var(--text-primary)] mb-6 leading-[1.1]">
              He designed over 100<br />
              legendary courses.<br />
              <span className="text-[var(--text-muted)]">He put his name on one.</span>
            </h1>
            
            <p className="text-lg text-[var(--text-secondary)] max-w-xl leading-relaxed">
              Carved from an abandoned coal mine in West Virginia, alongside two miners 
              who spent 18 years refusing to quit.
            </p>
          </div>
          
          <div className="mt-12 flex items-center gap-8 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-medium text-[var(--text-primary)]">{totalClips}</span>
              <span className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Clips</span>
            </div>
            <span className="w-px h-6 bg-[var(--border-visible)]" />
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-medium text-[var(--text-primary)]">{videosWithClips.length}</span>
              <span className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Tapes</span>
            </div>
            <span className="w-px h-6 bg-[var(--border-visible)]" />
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-medium text-[var(--text-primary)]">{orderedCategories.length}</span>
              <span className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Categories</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto space-y-16">
          {orderedCategories.map((categoryName) => {
            const categoryVideos = categories[categoryName];
            const categoryClipCount = categoryVideos.reduce((sum, v) => sum + v.clips.length, 0);
            
            return (
              <div key={categoryName}>
                {/* Category header */}
                <div className="flex items-center gap-4 mb-8">
                  <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
                    {categoryName}
                  </h2>
                  <span className="font-mono text-xs text-[var(--text-muted)]">
                    {categoryClipCount} clips
                  </span>
                  <span className="flex-1 h-px bg-[var(--border-subtle)]" />
                </div>

                {/* Videos in category */}
                <div className="space-y-8">
                  {categoryVideos.map((video) => (
                    <article key={video.id} className="card p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono text-[10px] text-[var(--amber)] uppercase tracking-wider">
                              Tape
                            </span>
                            <span className="font-mono text-[10px] text-[var(--text-muted)]">
                              {video.clips.length} clips
                            </span>
                          </div>
                          <h3 className="text-lg font-medium text-[var(--text-primary)] truncate">
                            {video.title || video.filename.replace(/_/g, ' ')}
                          </h3>
                          {video.summary && (
                            <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2">
                              {video.summary}
                            </p>
                          )}
                        </div>
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
      <footer className="border-t border-[var(--border-subtle)] px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--text-muted)] tracking-wider">
            PETE DYE GOLF CLUB — CLARKSBURG, WV
          </span>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            ◉ 1995
          </span>
        </div>
      </footer>
    </main>
  );
}

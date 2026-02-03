import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import type { Act, StoryElement, Clip } from '@/lib/types';
import ClipCarousel from '@/components/ClipCarousel';

interface ClipWithVideo extends Clip {
  video?: { filename: string };
}

interface PageProps {
  params: Promise<{ actId: string }>;
}

const getAct = unstable_cache(
  async (actId: string) => {
    const { data: act, error } = await supabase
      .from('acts')
      .select('*')
      .eq('id', actId)
      .single();
    
    if (error || !act) return null;
    return act as Act;
  },
  ['act'],
  { revalidate: 60 }
);

const getStoryElements = unstable_cache(
  async (actId: string) => {
    const { data, error } = await supabase
      .from('story_elements')
      .select('*')
      .eq('act_id', actId)
      .order('sort_order');
    
    if (error) throw error;
    return data as StoryElement[];
  },
  ['story-elements'],
  { revalidate: 60 }
);

const getClipsForStoryElement = unstable_cache(
  async (storyElementId: string) => {
    const { data, error } = await supabase
      .from('clip_story_links')
      .select(`
        clip_id,
        is_primary,
        clips (
          id,
          title,
          filename,
          storage_path,
          thumbnail_path,
          duration_seconds,
          description,
          videos (
            filename
          )
        )
      `)
      .eq('story_element_id', storyElementId)
      .order('is_primary', { ascending: false })
      .order('clip_id', { ascending: true });
    
    if (error) return [];
    return data;
  },
  ['clips-for-story'],
  { revalidate: 60 }
);

function getThumbnailPath(clip: ClipWithVideo): string {
  if (clip.thumbnail_path) return clip.thumbnail_path;
  const videoFilename = (clip.video?.filename || '').replace(/-/g, '_');
  const clipName = clip.filename?.replace('.mp4', '') || '';
  return `/thumbnails/${videoFilename}__${clipName}.jpg`;
}

function getClipPath(clip: ClipWithVideo): string {
  if (clip.storage_path) return clip.storage_path;
  // Clips are stored flat: {video_name}__{clip_name}.mp4
  const videoFilename = (clip.video?.filename || '').replace(/-/g, '_');
  const clipName = clip.filename?.replace('.mp4', '') || '';
  return `/clips/${videoFilename}__${clipName}.mp4`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function StoryElementCard({ element, clips, index }: { element: StoryElement; clips: ClipWithVideo[]; index: number }) {
  const isKeyMoment = element.element_type === 'key_moment';
  
  return (
    <article className={`card overflow-hidden ${isKeyMoment ? 'ring-1 ring-[var(--amber)]/20' : ''}`}>
      {/* Header */}
      <div className={`p-6 md:p-8 ${isKeyMoment ? 'bg-[var(--amber)]/[0.03]' : ''}`}>
        <div className="flex items-start gap-4 mb-4">
          <span className="font-mono text-[10px] text-[var(--text-muted)] mt-1">
            {String(index + 1).padStart(2, '0')}
          </span>
          
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              {isKeyMoment && (
                <span className="font-mono text-[9px] tracking-wider text-[var(--amber)] uppercase px-2 py-0.5 border border-[var(--amber)]/30 rounded">
                  Key Moment
                </span>
              )}
            </div>
            
            <h3 className={`text-xl font-semibold mb-2 ${
              isKeyMoment ? 'text-[var(--amber)]' : 'text-[var(--text-primary)]'
            }`}>
              {element.title}
            </h3>
            
            {element.description && (
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                {element.description}
              </p>
            )}
          </div>
          
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            {clips.length} {clips.length === 1 ? 'clip' : 'clips'}
          </span>
        </div>
        
        {element.quote && (
          <blockquote className="border-l-2 border-[var(--amber)]/40 pl-4 my-6 text-[var(--text-secondary)] italic">
            &ldquo;{element.quote}&rdquo;
          </blockquote>
        )}
        
        {element.why_it_matters && (
          <div className="bg-[var(--bg-elevated)] rounded-lg p-4 mt-4 border border-[var(--border-subtle)]">
            <span className="font-mono text-[9px] font-medium text-[var(--amber)] uppercase tracking-wider">
              Why it matters
            </span>
            <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">
              {element.why_it_matters}
            </p>
          </div>
        )}
      </div>
      
      {/* Clips */}
      <div className="px-6 md:px-8 py-6 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50">
        {clips.length > 0 ? (
          <ClipCarousel clips={clips} />
        ) : (
          <div className="h-20 flex items-center justify-center border border-dashed border-[var(--border-subtle)] rounded-lg">
            <span className="font-mono text-xs text-[var(--text-muted)]">No clips assigned</span>
          </div>
        )}
      </div>
    </article>
  );
}

export default async function ActPage({ params }: PageProps) {
  const { actId } = await params;
  const act = await getAct(actId);
  
  if (!act) {
    notFound();
  }
  
  const elements = await getStoryElements(actId);
  
  const elementsWithClips = await Promise.all(
    elements.map(async (element) => {
      const clipLinks = await getClipsForStoryElement(element.id);
      const clips = clipLinks
        .map((link: { clips: ClipWithVideo | ClipWithVideo[] | null }) => {
          const clip = link.clips;
          if (!clip || Array.isArray(clip)) return null;
          const videos = (clip as { videos?: { filename: string } | { filename: string }[] }).videos;
          const video = Array.isArray(videos) ? videos[0] : videos;
          return { ...clip, video } as ClipWithVideo;
        })
        .filter((c): c is ClipWithVideo => c !== null);
      return { element, clips };
    })
  );
  
  const totalClips = elementsWithClips.reduce((sum, { clips }) => sum + clips.length, 0);

  return (
    <main className="min-h-screen relative">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[var(--bg-deep)]/80 border-b border-[var(--border-subtle)]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="flex items-center gap-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="font-mono text-xs tracking-wider">Back</span>
            </Link>
            <span className="w-px h-4 bg-[var(--border-visible)]" />
            <span className="font-mono text-xs tracking-wider text-[var(--text-muted)]">
              Act {String(act.act_number).padStart(2, '0')}
            </span>
          </div>
          <div className="rec-indicator">
            <span>Playing</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-5xl mx-auto animate-slide-up">
          <div className="flex items-center gap-4 mb-6">
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--amber)] uppercase">
              Act {String(act.act_number).padStart(2, '0')}
            </span>
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {act.duration_target}
            </span>
            <span className="w-px h-4 bg-[var(--border-visible)]" />
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {totalClips} clips
            </span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-semibold text-[var(--text-primary)] mb-4 tracking-tight">
            {act.title}
          </h1>
          
          <p className="text-xl text-[var(--text-secondary)] max-w-2xl leading-relaxed">
            {act.description}
          </p>
          
          {act.tone && (
            <p className="font-mono text-xs text-[var(--text-muted)] mt-6">
              Tone: <span className="text-[var(--text-secondary)]">{act.tone}</span>
            </p>
          )}
        </div>
      </section>

      {/* Story Elements */}
      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="font-mono text-[10px] tracking-[0.2em] text-[var(--text-muted)] uppercase">
              Story Elements
            </h2>
            <span className="flex-1 h-px bg-[var(--border-subtle)]" />
            <span className="font-mono text-[10px] text-[var(--text-muted)]">
              {elements.length} elements
            </span>
          </div>
          
          <div className="space-y-6 stagger-children">
            {elementsWithClips.map(({ element, clips }, index) => (
              <StoryElementCard 
                key={element.id} 
                element={element} 
                clips={clips}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Footer navigation */}
      <footer className="border-t border-[var(--border-subtle)] px-6 py-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link 
            href="/"
            className="flex items-center gap-2 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--amber)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            All Acts
          </Link>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            ◉ PETE DYE GOLF CLUB
          </span>
        </div>
      </footer>
    </main>
  );
}

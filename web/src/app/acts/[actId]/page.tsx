import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import type { Act, StoryElement, Clip } from '@/lib/types';

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

// Helper to get thumbnail path
function getThumbnailPath(clip: ClipWithVideo): string {
  // Use database path if available (Supabase URL)
  if (clip.thumbnail_path) return clip.thumbnail_path;
  
  // Otherwise construct local path from video + clip filename
  const videoFilename = clip.video?.filename || '';
  const clipName = clip.filename?.replace('.mp4', '') || '';
  return `/thumbnails/${videoFilename}__${clipName}.jpg`;
}

function StoryElementCard({ element, clips }: { element: StoryElement; clips: ClipWithVideo[] }) {
  const isKeyMoment = element.element_type === 'key_moment';
  
  return (
    <div className={`p-6 rounded-xl border ${
      isKeyMoment 
        ? 'bg-amber-950/20 border-amber-800/50' 
        : 'bg-zinc-900 border-zinc-800'
    }`}>
      <div className="flex items-start gap-3 mb-3">
        {isKeyMoment && (
          <span className="text-amber-500 text-lg">★</span>
        )}
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${
            isKeyMoment ? 'text-amber-200' : 'text-white'
          }`}>
            {element.title}
          </h3>
          {element.description && (
            <p className="text-zinc-400 text-sm mt-1">
              {element.description}
            </p>
          )}
        </div>
      </div>
      
      {element.quote && (
        <blockquote className="border-l-2 border-zinc-700 pl-4 my-4 text-zinc-300 italic">
          &ldquo;{element.quote}&rdquo;
        </blockquote>
      )}
      
      {element.why_it_matters && (
        <div className="bg-zinc-800/50 rounded-lg p-3 mt-4">
          <span className="text-xs font-medium text-zinc-500 uppercase">Why it matters</span>
          <p className="text-sm text-zinc-300 mt-1">{element.why_it_matters}</p>
        </div>
      )}
      
      {/* Clips section */}
      <div className="mt-4 pt-4 border-t border-zinc-800">
        {clips.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-emerald-500">✓</span>
              <span className="text-xs text-zinc-500">{clips.length} clip{clips.length > 1 ? 's' : ''} available</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {clips.map((clip) => {
                const thumbPath = getThumbnailPath(clip);
                return (
                  <button
                    key={clip.id}
                    className="flex-shrink-0 w-56 bg-zinc-800 hover:bg-zinc-700 rounded-lg p-3 transition-colors group text-left"
                  >
                    <div className="w-full h-28 bg-zinc-700 rounded overflow-hidden relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={thumbPath}
                        alt={clip.title || clip.filename}
                        className="w-full h-full object-cover"
                      />
                      {/* Play overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-10 h-10 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </div>
                      {/* Duration badge */}
                      {clip.duration_seconds && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 rounded">
                          {Math.floor(clip.duration_seconds / 60)}:{String(Math.round(clip.duration_seconds % 60)).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-300 mt-2 line-clamp-3">
                      {clip.description || clip.title || clip.filename?.replace('.mp4', '')}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-500">⚠️</span>
            <span className="text-xs text-zinc-500">No clips linked yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ActPage({ params }: PageProps) {
  const { actId } = await params;
  const act = await getAct(actId);
  
  if (!act) {
    notFound();
  }
  
  const elements = await getStoryElements(actId);
  
  // Separate journey points and key moments
  const journeyPoints = elements.filter(e => e.element_type === 'journey_point');
  const keyMoments = elements.filter(e => e.element_type === 'key_moment');
  
  // Get clips for each element (in a real app, we'd batch this)
  const elementsWithClips = await Promise.all(
    elements.map(async (element) => {
      const clipLinks = await getClipsForStoryElement(element.id);
      const clips = clipLinks
        .map((link: { clips: ClipWithVideo | ClipWithVideo[] | null }) => {
          const clip = link.clips;
          if (!clip || Array.isArray(clip)) return null;
          // Extract video from nested structure
          const videos = (clip as { videos?: { filename: string } | { filename: string }[] }).videos;
          const video = Array.isArray(videos) ? videos[0] : videos;
          return { ...clip, video } as ClipWithVideo;
        })
        .filter((c): c is ClipWithVideo => c !== null);
      return { element, clips };
    })
  );
  
  const journeyPointsWithClips = elementsWithClips.filter(
    ({ element }) => element.element_type === 'journey_point'
  );
  const keyMomentsWithClips = elementsWithClips.filter(
    ({ element }) => element.element_type === 'key_moment'
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
            ← Back
          </Link>
          <span className="text-zinc-700">|</span>
          <h1 className="text-lg font-semibold text-zinc-100">
            Act {act.act_number}: {act.title}
          </h1>
        </div>
      </header>

      {/* Act Overview */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-zinc-500">
            ACT {act.act_number}
          </span>
          <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">
            {act.duration_target}
          </span>
        </div>
        
        <h2 className="text-4xl font-bold text-white mb-4">{act.title}</h2>
        
        <p className="text-xl text-zinc-400 mb-4">{act.description}</p>
        
        <p className="text-sm text-zinc-600 italic">
          Tone: {act.tone}
        </p>
      </section>

      {/* Journey Points */}
      <section className="max-w-4xl mx-auto px-6 pb-12">
        <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-6">
          Story Elements ({journeyPoints.length})
        </h3>
        
        <div className="space-y-4">
          {journeyPointsWithClips.map(({ element, clips }) => (
            <StoryElementCard key={element.id} element={element} clips={clips} />
          ))}
        </div>
      </section>

      {/* Key Moments */}
      {keyMoments.length > 0 && (
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <h3 className="text-sm font-medium text-amber-500 uppercase tracking-wider mb-6">
            Key Emotional Moments ({keyMoments.length})
          </h3>
          
          <div className="space-y-4">
            {keyMomentsWithClips.map(({ element, clips }) => (
              <StoryElementCard key={element.id} element={element} clips={clips} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

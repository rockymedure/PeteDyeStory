import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import type { Act, StoryElement, Clip } from '@/lib/types';
import ClipCarousel from '@/components/ClipCarousel';

interface ClipWithVideo extends Clip {
  video?: { filename: string };
}

interface StoryElementWithClips extends StoryElement {
  clips: ClipWithVideo[];
}

interface ActWithElements extends Act {
  story_elements: StoryElementWithClips[];
  total_clips: number;
}

const getActsWithElements = unstable_cache(
  async () => {
    const { data: acts, error: actsError } = await supabase
      .from('acts')
      .select('*')
      .order('act_number');
    
    if (actsError) throw actsError;

    const { data: elements, error: elementsError } = await supabase
      .from('story_elements')
      .select('*')
      .order('sort_order');
    
    if (elementsError) throw elementsError;

    const { data: clipLinks, error: clipsError } = await supabase
      .from('clip_story_links')
      .select(`
        story_element_id,
        is_primary,
        clips (
          id,
          filename,
          storage_path,
          thumbnail_path,
          duration_seconds,
          description,
          videos (filename)
        )
      `)
      .order('is_primary', { ascending: false });
    
    if (clipsError) throw clipsError;

    const clipsByElement: Record<string, ClipWithVideo[]> = {};
    for (const link of clipLinks || []) {
      const elementId = link.story_element_id;
      if (!elementId) continue;
      if (!clipsByElement[elementId]) clipsByElement[elementId] = [];
      
      const clip = link.clips as unknown as (ClipWithVideo & { videos?: { filename: string } | { filename: string }[] });
      if (clip) {
        const videos = clip.videos;
        const video = Array.isArray(videos) ? videos[0] : videos;
        clipsByElement[elementId].push({ ...clip, video });
      }
    }

    const actsWithElements: ActWithElements[] = (acts as Act[]).map(act => {
      const actElements = (elements as StoryElement[])
        .filter(e => e.act_id === act.id)
        .map(e => ({
          ...e,
          clips: clipsByElement[e.id] || []
        }));
      
      const totalClips = actElements.reduce((sum, e) => sum + e.clips.length, 0);
      
      return {
        ...act,
        story_elements: actElements,
        total_clips: totalClips
      };
    });

    return actsWithElements;
  },
  ['acts-with-elements-v3'],
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
  const acts = await getActsWithElements();
  const totalClips = acts.reduce((sum, act) => sum + act.total_clips, 0);

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
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-slide-up">
            <p className="font-mono text-[10px] tracking-[0.3em] text-[var(--amber)] uppercase mb-6">
              Documentary Film Project
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
              <span className="font-mono text-2xl font-medium text-[var(--text-primary)]">3</span>
              <span className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Acts</span>
            </div>
            <span className="w-px h-6 bg-[var(--border-visible)]" />
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-medium text-[var(--text-primary)]">30-40</span>
              <span className="font-mono text-xs text-[var(--text-muted)] uppercase tracking-wider">Minutes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Acts */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto space-y-8 stagger-children">
          {acts.map((act, actIndex) => (
            <article key={act.id} className="card overflow-hidden">
              {/* Act Header */}
              <Link 
                href={`/acts/${act.id}`}
                className="block p-8 md:p-10 group"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1">
                    {/* Act label with timecode style */}
                    <div className="flex items-center gap-4 mb-4">
                      <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--amber)] uppercase">
                        Act {String(act.act_number).padStart(2, '0')}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        {act.duration_target}
                      </span>
                    </div>
                    
                    <h2 className="text-3xl md:text-4xl font-semibold text-[var(--text-primary)] mb-3 group-hover:text-[var(--amber)] transition-colors duration-300">
                      {act.title}
                    </h2>
                    
                    <p className="text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                      {act.description}
                    </p>
                  </div>
                  
                  {/* Clip counter */}
                  <div className="hidden md:flex flex-col items-end">
                    <span className="font-mono text-4xl font-medium text-[var(--text-muted)] group-hover:text-[var(--amber)] transition-colors">
                      {String(act.total_clips).padStart(3, '0')}
                    </span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider mt-1">
                      clips
                    </span>
                  </div>
                </div>
              </Link>

              {/* Story Elements */}
              <div className="border-t border-[var(--border-subtle)]">
                {act.story_elements.map((element, elementIndex) => {
                  const isKeyMoment = element.element_type === 'key_moment';
                  
                  return (
                    <div 
                      key={element.id}
                      className={`px-8 md:px-10 py-6 border-b border-[var(--border-subtle)] last:border-b-0 ${
                        isKeyMoment ? 'bg-[var(--amber)]/[0.03]' : ''
                      }`}
                    >
                      {/* Element header */}
                      <div className="flex items-center gap-4 mb-4">
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {String(actIndex + 1)}.{String(elementIndex + 1).padStart(2, '0')}
                        </span>
                        
                        {isKeyMoment && (
                          <span className="font-mono text-[9px] tracking-wider text-[var(--amber)] uppercase px-2 py-0.5 border border-[var(--amber)]/30 rounded">
                            Key Moment
                          </span>
                        )}
                        
                        <span className={`text-sm font-medium flex-1 ${
                          isKeyMoment ? 'text-[var(--amber)]' : 'text-[var(--text-primary)]'
                        }`}>
                          {element.title}
                        </span>
                        
                        <span className="font-mono text-[10px] text-[var(--text-muted)]">
                          {element.clips.length} {element.clips.length === 1 ? 'clip' : 'clips'}
                        </span>
                      </div>
                      
                      {/* Clips carousel */}
                      {element.clips.length > 0 ? (
                        <ClipCarousel clips={element.clips} />
                      ) : (
                        <div className="h-20 flex items-center justify-center border border-dashed border-[var(--border-subtle)] rounded-lg">
                          <span className="font-mono text-xs text-[var(--text-muted)]">No clips assigned</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Act footer */}
              <Link 
                href={`/acts/${act.id}`}
                className="flex items-center justify-between px-8 md:px-10 py-4 bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] group/link"
              >
                <span className="font-mono text-xs text-[var(--text-muted)] group-hover/link:text-[var(--text-secondary)] transition-colors">
                  View full act breakdown
                </span>
                <svg 
                  className="w-4 h-4 text-[var(--text-muted)] group-hover/link:text-[var(--amber)] group-hover/link:translate-x-1 transition-all" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </article>
          ))}
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

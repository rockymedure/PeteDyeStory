import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { Act, StoryElement } from '@/lib/types';

async function getActs() {
  const { data: acts, error } = await supabase
    .from('acts')
    .select('*')
    .order('act_number');
  
  if (error) throw error;
  return acts as Act[];
}

async function getStoryElementCounts() {
  const { data, error } = await supabase
    .from('story_elements')
    .select('act_id, element_type');
  
  if (error) throw error;
  
  const counts: Record<string, { journey_points: number; key_moments: number }> = {};
  
  for (const element of data as StoryElement[]) {
    if (!element.act_id) continue;
    if (!counts[element.act_id]) {
      counts[element.act_id] = { journey_points: 0, key_moments: 0 };
    }
    if (element.element_type === 'journey_point') {
      counts[element.act_id].journey_points++;
    } else if (element.element_type === 'key_moment') {
      counts[element.act_id].key_moments++;
    }
  }
  
  return counts;
}

export default async function Home() {
  const acts = await getActs();
  const elementCounts = await getStoryElementCounts();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h1 className="text-xl font-semibold text-zinc-100">Pete Dye Film Browser</h1>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Pete Dye Golf Club Documentary
        </h2>
        <p className="text-xl text-zinc-400 max-w-3xl mb-2">
          Pete Dye designed over 100 legendary golf courses. He put his name on one.
        </p>
        <p className="text-lg text-zinc-500 max-w-3xl">
          Carved from an abandoned coal mine in West Virginia, alongside two miners who spent 18 years refusing to quit. This is the story of why.
        </p>
        
        <div className="flex gap-4 mt-8 text-sm text-zinc-500">
          <span className="px-3 py-1 bg-zinc-800 rounded-full">30-40 min runtime</span>
          <span className="px-3 py-1 bg-zinc-800 rounded-full">3 acts</span>
          <span className="px-3 py-1 bg-zinc-800 rounded-full">180+ clips</span>
        </div>
      </section>

      {/* Acts Grid */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-6">
          Film Structure
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          {acts.map((act) => {
            const counts = elementCounts[act.id] || { journey_points: 0, key_moments: 0 };
            
            return (
              <Link
                key={act.id}
                href={`/acts/${act.id}`}
                className="group block bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 hover:bg-zinc-900/80 transition-all"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-sm font-medium text-zinc-500">
                    ACT {act.act_number}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {act.duration_target}
                  </span>
                </div>
                
                <h4 className="text-2xl font-bold text-white mb-3 group-hover:text-emerald-400 transition-colors">
                  {act.title}
                </h4>
                
                <p className="text-zinc-400 text-sm mb-4 line-clamp-2">
                  {act.description}
                </p>
                
                <div className="flex gap-3 text-xs text-zinc-500 mb-4">
                  <span>{counts.journey_points} story points</span>
                  {counts.key_moments > 0 && (
                    <span className="text-amber-500">
                      {counts.key_moments} key moment{counts.key_moments > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                
                <div className="pt-4 border-t border-zinc-800">
                  <span className="text-xs text-zinc-600 italic">
                    {act.tone}
                  </span>
                </div>
                
                <div className="mt-4 flex items-center text-sm text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  View story elements →
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quick Stats */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">
            How to use this tool
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm text-zinc-400">
            <div>
              <span className="text-emerald-500 font-medium">1. Browse by Act</span>
              <p className="mt-1">Click any act to see its story elements and available footage.</p>
            </div>
            <div>
              <span className="text-emerald-500 font-medium">2. Find Clips</span>
              <p className="mt-1">Each story point shows clips that support it. Play instantly.</p>
            </div>
            <div>
              <span className="text-emerald-500 font-medium">3. Identify Gaps</span>
              <p className="mt-1">Coverage indicators show what footage exists vs. what&apos;s needed.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

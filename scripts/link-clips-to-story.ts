/**
 * Auto-link clips to story elements based on video-to-act mapping and content analysis
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mnqrxepacvmlbhczvwaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucXJ4ZXBhY3ZtbGJoY3p2d2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzYwNDYsImV4cCI6MjA4NTY1MjA0Nn0.-UUV1PU0vWgfI-SWKf2rrNHo4QhZLLW1PvfoSahviRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Keywords that map videos to specific story elements
const videoToStoryKeywords: Record<string, string[]> = {
  // ACT I - The Dream
  'Coal_Mining': ['LaRosa immigrant story', 'Heritage'],
  'Harris_Holt': ['Pete Dye at the height', "Pete's commitment"],
  'Interview_With_Pete_Dye': ['Pete Dye at the height', "Pete's commitment", "Pete's perfectionism"],
  '1982-1988': ['LaRosa immigrant story', 'The rejected first site'],
  
  // ACT II - The Struggle
  'Construction': ['The long road', 'Near-misses'],
  'Simpson_Creek': ['The long road'],
  '1985': ['The long road'],
  '1987': ['The long road'],
  '1989': ['The long road', 'The team that formed'],
  '1990': ['The long road'],
  '1991': ['The long road'],
  '1992': ['The long road'],
  '1993': ['The long road', 'Near-misses'],
  '1994': ['The long road'],
  'Papa_Jim': ["Pete's perfectionism", 'Partnership'],
  'Christmas_Party': ['The team that formed'],
  'DiMaggio': ['The team that formed'],
  'Dinner': ['The team that formed'],
  'Member-Guest': ['The team that formed'],
  
  // ACT III - The Arrival
  'Grand_Opening': ['July 4, 1995', 'Opening Day', 'The Bell on #12'],
  'Opening_7-3-1993': ['July 4, 1995', 'Opening Day'],
  'back_nine': ['July 4, 1995'],
  'Citizen_of_the_Year': ['National recognition'],
  'CBS_Promo': ['National recognition'],
  'WV_Classic': ['The traditions that took root', 'Legacy'],
  'Nationwide_Tour': ['The traditions that took root'],
};

async function main() {
  console.log('🔗 Linking clips to story elements...\n');
  
  // Get all videos with their clips
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select(`
      id,
      filename,
      clips (id, filename)
    `);
  
  if (videosError) {
    console.error('Error fetching videos:', videosError);
    return;
  }
  
  // Get all story elements
  const { data: storyElements, error: elementsError } = await supabase
    .from('story_elements')
    .select('id, title, act_id, element_type');
  
  if (elementsError) {
    console.error('Error fetching story elements:', elementsError);
    return;
  }
  
  console.log(`Found ${videos?.length || 0} videos and ${storyElements?.length || 0} story elements\n`);
  
  let linksCreated = 0;
  
  for (const video of videos || []) {
    const filename = video.filename;
    const clips = video.clips as Array<{ id: string; filename: string }>;
    
    if (!clips || clips.length === 0) continue;
    
    // Find matching story elements based on keywords
    const matchingElements: string[] = [];
    
    for (const [keyword, elementTitles] of Object.entries(videoToStoryKeywords)) {
      if (filename.includes(keyword)) {
        matchingElements.push(...elementTitles);
      }
    }
    
    if (matchingElements.length === 0) continue;
    
    // Find the actual story element IDs
    const elementIds = storyElements
      ?.filter(e => matchingElements.some(title => e.title.includes(title)))
      .map(e => e.id) || [];
    
    if (elementIds.length === 0) continue;
    
    console.log(`📹 ${filename}`);
    console.log(`   Matched elements: ${matchingElements.slice(0, 3).join(', ')}${matchingElements.length > 3 ? '...' : ''}`);
    
    // Link each clip to each matching story element
    for (const clip of clips) {
      for (const elementId of elementIds) {
        const { error } = await supabase
          .from('clip_story_links')
          .upsert({
            clip_id: clip.id,
            story_element_id: elementId,
            is_primary: elementIds.indexOf(elementId) === 0
          }, { onConflict: 'clip_id,story_element_id' });
        
        if (!error) {
          linksCreated++;
        }
      }
    }
    
    console.log(`   ✓ Linked ${clips.length} clips to ${elementIds.length} elements`);
  }
  
  console.log(`\n✅ Created ${linksCreated} clip-to-story links`);
}

main().catch(console.error);

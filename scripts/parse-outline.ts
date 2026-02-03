/**
 * Parse FILM-OUTLINE.md and populate Supabase database with acts and story elements
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mnqrxepacvmlbhczvwaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucXJ4ZXBhY3ZtbGJoY3p2d2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzYwNDYsImV4cCI6MjA4NTY1MjA0Nn0.-UUV1PU0vWgfI-SWKf2rrNHo4QhZLLW1PvfoSahviRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Acts data extracted from FILM-OUTLINE.md
const acts = [
  {
    act_number: 1,
    title: 'THE DREAM',
    description: 'Introduce the LaRosa family heritage, Pete Dye, and the improbable partnership they formed.',
    duration_target: '8-10 min',
    tone: 'Aspirational, nostalgic, underdog setup'
  },
  {
    act_number: 2,
    title: 'THE STRUGGLE',
    description: 'The years of obstacles, the relationships that formed, and what it took to keep going.',
    duration_target: '10-15 min',
    tone: 'Gritty, determined, moments of humor and camaraderie'
  },
  {
    act_number: 3,
    title: 'THE ARRIVAL',
    description: 'The opening, national recognition, and the legacy that followed.',
    duration_target: '10-15 min',
    tone: 'Triumphant, emotional, reflective'
  }
];

// Story elements (journey points) for each act
const storyElements = {
  1: [ // ACT I
    {
      element_type: 'journey_point',
      title: 'The LaRosa immigrant story',
      description: 'Coal miners who built a life in West Virginia',
      sort_order: 1
    },
    {
      element_type: 'journey_point',
      title: 'Pete Dye at the height of his career',
      description: 'Legendary architect, known for impossible projects',
      sort_order: 2
    },
    {
      element_type: 'journey_point',
      title: 'The rejected first site vs. the abandoned strip mine',
      description: 'Pete chose the coal mine site that no one else could see potential in',
      sort_order: 3
    },
    {
      element_type: 'journey_point',
      title: "Pete's commitment",
      description: '"If you give me total freedom, this could be one of the finest inland courses in the country."',
      quote: 'If you give me total freedom, this could be one of the finest inland courses in the country.',
      sort_order: 4
    }
  ],
  2: [ // ACT II
    {
      element_type: 'journey_point',
      title: 'The long road',
      description: '18 years of setbacks, weather, financial pressure, skeptics',
      sort_order: 1
    },
    {
      element_type: 'journey_point',
      title: "Pete's perfectionism and the creative partnership",
      description: 'The bond between Pete Dye and James D. LaRosa',
      sort_order: 2
    },
    {
      element_type: 'journey_point',
      title: 'The team that formed',
      description: 'Superintendent, pros, staff who became family',
      sort_order: 3
    },
    {
      element_type: 'journey_point',
      title: 'Near-misses and close calls',
      description: 'Challenges that would have stopped most people',
      sort_order: 4
    }
  ],
  3: [ // ACT III
    {
      element_type: 'journey_point',
      title: 'July 4, 1995 — The Grand Opening',
      description: 'The Grand Opening celebration after 18 years',
      sort_order: 1
    },
    {
      element_type: 'journey_point',
      title: 'National recognition',
      description: 'Links Magazine, Golf Digest, USGA rankings',
      sort_order: 2
    },
    {
      element_type: 'journey_point',
      title: 'The traditions that took root',
      description: 'Tournaments, members, community',
      sort_order: 3
    },
    {
      element_type: 'journey_point',
      title: 'What it means to West Virginia',
      description: 'Legacy for the next generation',
      sort_order: 4
    }
  ]
};

// Key emotional moments (special story elements)
const keyMoments = [
  {
    act_number: 2, // Happens during the struggle
    element_type: 'key_moment',
    title: 'Pete Names the Club',
    description: 'On the 6th fairway, after years of debating names, Pete asks Jimmy: "Do we have a name yet?" Jimmy says no. Pete: "The hell with it. Let\'s call it Pete Dye." A handshake. Then: "I want you to know this will be the only club named after me."',
    why_it_matters: 'This is when Pete stakes his legacy on this project. Of 100+ courses, he chose this one.',
    quote: 'The hell with it. Let\'s call it Pete Dye... I want you to know this will be the only club named after me.',
    sort_order: 10
  },
  {
    act_number: 3, // Climax at the opening
    element_type: 'key_moment',
    title: 'The Bell on #12',
    description: 'A bell was installed on the 12th hole in memory of Pete\'s father—the man who built Pete\'s first nine holes. On Grand Opening morning, Pete sees it for the first time and rings it. The emotion is visible.',
    why_it_matters: 'This is the emotional climax. The father-son thread runs through the whole story—James D. and Jimmy, Pete and his father.',
    sort_order: 11
  },
  {
    act_number: 3,
    element_type: 'key_moment',
    title: 'Opening Day',
    description: 'After 15-18 years of work, the course is finally real. Standing on the first tee with family. Bagpipes. Fireworks. The dream made tangible.',
    why_it_matters: 'The payoff moment. Everything they endured was for this.',
    sort_order: 12
  }
];

// Key themes
const themes = [
  { title: 'Perseverance', description: '18 years of refusing to quit' },
  { title: 'Partnership', description: 'The bond between a coal mining family and a golf legend' },
  { title: 'West Virginia Pride', description: 'Putting an overlooked place on the map' },
  { title: 'Heritage', description: 'Coal mining past meets championship golf future' },
  { title: 'Legacy', description: 'What we build and what we leave behind' }
];

// Central characters
const characters = [
  {
    title: 'James D. LaRosa',
    description: 'Son of Italian immigrants, worked the coal mines, built a business. The dreamer who refused to give up.',
    quote: 'The toughest, most tenacious, never-give-up son of a gun I ever worked for.'
  },
  {
    title: 'Jimmy LaRosa',
    description: "James D.'s son. Worked alongside his father and Pete for 18 years. Managed the project, secured financing, carries the story forward. Primary narrator."
  },
  {
    title: 'Pete Dye',
    description: "The architect. One of golf's greatest designers. Perfectionist, mentor, friend. Of 100+ courses, this is the only one he put his name on."
  },
  {
    title: 'Alice Dye',
    description: "Pete's wife and collaborator. Pushed for the course to be welcoming to all players. Her influence shaped the final design.",
    quote: "Pete, if this is designed to be a men's club, you won't finish the course."
  }
];

async function main() {
  console.log('🎬 Parsing FILM-OUTLINE.md and populating Supabase...\n');

  // 1. Insert acts
  console.log('📁 Creating acts...');
  const actIds: Record<number, string> = {};
  
  for (const act of acts) {
    const { data, error } = await supabase
      .from('acts')
      .upsert(act, { onConflict: 'act_number' })
      .select()
      .single();
    
    if (error) {
      console.error(`  ❌ Error inserting Act ${act.act_number}:`, error.message);
    } else {
      actIds[act.act_number] = data.id;
      console.log(`  ✓ Act ${act.act_number}: ${act.title}`);
    }
  }

  // 2. Insert journey points for each act
  console.log('\n📝 Creating story elements (journey points)...');
  
  for (const [actNum, elements] of Object.entries(storyElements)) {
    const actId = actIds[parseInt(actNum)];
    if (!actId) continue;
    
    for (const element of elements) {
      const { error } = await supabase
        .from('story_elements')
        .insert({ ...element, act_id: actId });
      
      if (error) {
        console.error(`  ❌ Error inserting "${element.title}":`, error.message);
      } else {
        console.log(`  ✓ Act ${actNum}: ${element.title}`);
      }
    }
  }

  // 3. Insert key moments
  console.log('\n⭐ Creating key emotional moments...');
  
  for (const moment of keyMoments) {
    const actId = actIds[moment.act_number];
    if (!actId) continue;
    
    const { act_number, ...momentData } = moment;
    const { error } = await supabase
      .from('story_elements')
      .insert({ ...momentData, act_id: actId });
    
    if (error) {
      console.error(`  ❌ Error inserting "${moment.title}":`, error.message);
    } else {
      console.log(`  ✓ ${moment.title}`);
    }
  }

  // 4. Insert themes (not tied to specific act)
  console.log('\n🎯 Creating themes...');
  
  for (const [i, theme] of themes.entries()) {
    const { error } = await supabase
      .from('story_elements')
      .insert({
        element_type: 'theme',
        title: theme.title,
        description: theme.description,
        sort_order: i + 1
      });
    
    if (error) {
      console.error(`  ❌ Error inserting theme "${theme.title}":`, error.message);
    } else {
      console.log(`  ✓ ${theme.title}`);
    }
  }

  // 5. Insert characters
  console.log('\n👥 Creating characters...');
  
  for (const [i, char] of characters.entries()) {
    const { error } = await supabase
      .from('story_elements')
      .insert({
        element_type: 'character',
        title: char.title,
        description: char.description,
        quote: char.quote,
        sort_order: i + 1
      });
    
    if (error) {
      console.error(`  ❌ Error inserting character "${char.title}":`, error.message);
    } else {
      console.log(`  ✓ ${char.title}`);
    }
  }

  console.log('\n✅ Done! Database populated with film outline structure.');
}

main().catch(console.error);

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load env from web/.env.local
const envPath = '/Users/rockymedure/Desktop/PeteDyeStory/web/.env.local';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

const OUTPUT_DIR = '/Users/rockymedure/Desktop/PeteDyeStory/video-processing/output';

interface ChapterInfo {
  timeRange: string;
  description: string;
}

function parseChapterBreakdown(synthesisText: string): ChapterInfo[] {
  const chapters: ChapterInfo[] = [];
  
  // Find CHAPTER BREAKDOWN section
  const chapterMatch = synthesisText.match(/\*\*3\. CHAPTER BREAKDOWN\*\*:\s*([\s\S]*?)(?=\*\*4\.|$)/);
  if (!chapterMatch) return chapters;
  
  // Parse individual chapters
  const chapterLines = chapterMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
  
  for (const line of chapterLines) {
    // Match pattern: "- **0:00:00 - 0:05:00**: Description"
    const match = line.match(/\*\*(\d+:\d+:\d+)\s*-\s*(\d+:\d+:\d+)\*\*:\s*(.+)/);
    if (match) {
      chapters.push({
        timeRange: `${match[1]} - ${match[2]}`,
        description: match[3].trim()
      });
    }
  }
  
  return chapters;
}

function parseSummary(synthesisText: string): string | null {
  const match = synthesisText.match(/\*\*1\. SUMMARY\*\*:\s*\n([^\n*]+)/);
  return match ? match[1].trim() : null;
}

async function main() {
  console.log('Fetching videos from database...');
  
  // Get all videos
  const { data: videos, error: videosError } = await supabase
    .from('videos')
    .select('id, filename');
  
  if (videosError || !videos) {
    console.error('Error fetching videos:', videosError);
    return;
  }
  
  console.log(`Found ${videos.length} videos\n`);
  
  let updatedCount = 0;
  
  for (const video of videos) {
    // Find the output directory for this video
    const videoName = video.filename.replace('.mp4', '');
    const outputPath = path.join(OUTPUT_DIR, videoName, 'analysis', 'simple_director_analysis.json');
    
    if (!fs.existsSync(outputPath)) {
      console.log(`⚠️ No analysis found for ${videoName}`);
      continue;
    }
    
    // Parse analysis
    const analysis = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    const synthesisText = analysis?.video_analysis?.synthesis_text;
    
    if (!synthesisText) {
      console.log(`⚠️ No synthesis text for ${videoName}`);
      continue;
    }
    
    const chapters = parseChapterBreakdown(synthesisText);
    const summary = parseSummary(synthesisText);
    
    console.log(`📹 ${videoName}: ${chapters.length} chapters found`);
    
    // Get clips for this video
    const { data: clips, error: clipsError } = await supabase
      .from('clips')
      .select('id, filename, title')
      .eq('video_id', video.id)
      .order('filename');
    
    if (clipsError || !clips) {
      console.log(`  ⚠️ Error fetching clips: ${clipsError?.message}`);
      continue;
    }
    
    // Update each clip with chapter description
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      let description: string;
      
      if (i < chapters.length) {
        // Use chapter description
        description = chapters[i].description;
      } else if (summary) {
        // Fallback to video summary for extra clips
        description = `From: ${summary.slice(0, 150)}${summary.length > 150 ? '...' : ''}`;
      } else {
        description = `Clip ${i + 1} from ${videoName}`;
      }
      
      // Update clip in database
      const { error: updateError } = await supabase
        .from('clips')
        .update({ description })
        .eq('id', clip.id);
      
      if (updateError) {
        console.log(`  ❌ Error updating ${clip.filename}: ${updateError.message}`);
      } else {
        console.log(`  ✓ ${clip.filename}: ${description.slice(0, 50)}...`);
        updatedCount++;
      }
    }
  }
  
  console.log(`\n✅ Updated ${updatedCount} clips with descriptions`);
}

main().catch(console.error);

/**
 * Migrate video/clip metadata to Supabase and upload clips to storage
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = 'https://mnqrxepacvmlbhczvwaj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ucXJ4ZXBhY3ZtbGJoY3p2d2FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNzYwNDYsImV4cCI6MjA4NTY1MjA0Nn0.-UUV1PU0vWgfI-SWKf2rrNHo4QhZLLW1PvfoSahviRw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const OUTPUT_DIR = '/Users/rockymedure/Desktop/PeteDyeStory/video-processing/output';
const WEB_CLIPS_DIR = '/Users/rockymedure/Desktop/PeteDyeStory/web-clips';
const THUMBS_DIR = '/Users/rockymedure/Desktop/PeteDyeStory/web-clips/thumbnails';

// Video to Act mapping based on VIDEO-ASSETS.md
const videoActMapping: Record<string, number[]> = {
  // ACT I - The Dream
  'Joung_JJL_Coal_Mining_Footage_No_Sound': [1],
  'The_Pete_Dye_Golf_Course_Narrated_by_Harris_Holt': [1],
  'Interview_With_Pete_Dye_7-10-94': [1, 2],
  'Some_Highlites_of_the_Pete_Dye_-_LaRosa_Golf_Course_Aug__1982-1988__2_-009': [1],
  
  // ACT II - The Struggle
  'Aug_1985_PDGC_Construction_Cleaning_out_Simpson_Creek': [2],
  'Pete_Dye_Golf_Course_Construction_6-18-1987_thru_10-6-1987': [2],
  'Pete_Dye_Golf_Club_Spring_1989': [2],
  'Highlites_of_the_Pete_Dye_-_LaRosa_Flof_Course_10-89_thru_10-90_James_D_s_cats_and_Dogs': [2],
  'Pete_Dye_Golf_Course_10-16-90_thru_6-14-91': [2],
  'Pete_Dye_Golf_Club_4-27-91_thru_10-10-91_Holes_1_thru_9': [2],
  'Pete_Dye_Golf_Club_9-9-1992': [2],
  'Pete_Dye_Golf_Club_9-5-92_thru_7-1-93-008': [2],
  'Oct__1992_thru_Dec__1992': [2],
  'PDGC_Construction_8-31-93_thru_7-7-94-012': [2],
  'Papa_Jim_Interview_Eastpointe_Shopping_Cneter_Blast': [2],
  '12-15-89_-_LaRosa_Annual_Christmas_Party': [2],
  'Joe_Dimaggio_Special_Guest_At_the_PDBC': [2],
  'PDGC_Member-Guest_Dinner___Dnace_at_Green_Acres_8-21-1993': [2],
  '9-1-90_Friends_of_James_D__s_Dinner_at_Nona_Maria_s_Pool_at_Jimmy_Joe_s_House': [2],
  
  // ACT III - The Arrival
  'PDGC_Opening_7-3-1993': [3],
  'PDGC_Grand_Opening': [3],
  'PDGC_1994_Opening_of_the_back_nine_Bember-Guest': [3],
  'Harrison_Co__Chamber_of_Commerce_Citizen_of_the_Year_Award_1995_Presented_to_James_D__LaRosa-006': [3],
  'PDGC_CBS_Promo_10-19-98': [3],
  'Disc_I__Pete_Dye_WV_Classic_July_15_16_2004-020': [3],
  'Disc_III_Pete_Dye_WV_Classic_July_15_16_2004': [3],
  'Pete_Dye_WV_Classic_Nationwide_Tour_July_15-16_2004-019': [3],
  'Pete_Dye_Golf_Course_Highlights_And_Interviews__2_-002': [1, 2, 3],
  'Pete_Dye_Golf_Club': [1, 2, 3],
};

interface VideoAnalysis {
  video_analysis: {
    synthesis_text: string;
    total_segments: number;
    total_duration_minutes: number;
  };
  raw_segments?: Array<{
    segment_id: number;
    timestamp_range: string;
  }>;
  processing_metadata?: {
    processing_time_seconds: number;
  };
}

async function getActIds(): Promise<Record<number, string>> {
  const { data, error } = await supabase
    .from('acts')
    .select('id, act_number');
  
  if (error) throw error;
  
  const actIds: Record<number, string> = {};
  for (const act of data) {
    actIds[act.act_number] = act.id;
  }
  return actIds;
}

function parseAnalysis(analysisPath: string): VideoAnalysis | null {
  try {
    const content = fs.readFileSync(analysisPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function extractSummary(synthesisText: string): string {
  // Extract summary section from synthesis text
  const summaryMatch = synthesisText.match(/\*\*1\. SUMMARY\*\*:?\s*\n?([\s\S]*?)(?=\n\*\*2\.|$)/i);
  if (summaryMatch) {
    return summaryMatch[1].trim().substring(0, 500);
  }
  return synthesisText.substring(0, 500);
}

function extractCharacters(synthesisText: string): string[] {
  const charsMatch = synthesisText.match(/\*\*2\. CHARACTERS\*\*:?\s*\n?([\s\S]*?)(?=\n\*\*3\.|$)/i);
  if (charsMatch) {
    const chars = charsMatch[1].match(/- ([^\n]+)/g) || [];
    return chars.map(c => c.replace(/^- /, '').split(':')[0].trim());
  }
  return [];
}

async function uploadFile(filePath: string, bucket: string, storagePath: string): Promise<string | null> {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, fileBuffer, {
        contentType: filePath.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg',
        upsert: true
      });
    
    if (error) {
      console.error(`  Upload error for ${storagePath}:`, error.message);
      return null;
    }
    
    return data.path;
  } catch (err) {
    console.error(`  File read error for ${filePath}:`, err);
    return null;
  }
}

async function main() {
  console.log('🎬 Migrating video/clip data to Supabase...\n');
  
  // Get act IDs
  const actIds = await getActIds();
  console.log('Act IDs:', actIds);
  
  // Create storage buckets if they don't exist
  console.log('\n📦 Ensuring storage buckets exist...');
  for (const bucket of ['clips', 'thumbnails']) {
    const { error } = await supabase.storage.createBucket(bucket, { public: true });
    if (error && !error.message.includes('already exists')) {
      console.error(`  Error creating bucket ${bucket}:`, error.message);
    } else {
      console.log(`  ✓ Bucket: ${bucket}`);
    }
  }
  
  // Get list of video output directories
  const videoDirs = fs.readdirSync(OUTPUT_DIR)
    .filter(d => fs.statSync(path.join(OUTPUT_DIR, d)).isDirectory())
    .filter(d => !d.startsWith('.'));
  
  console.log(`\n📹 Processing ${videoDirs.length} video directories...\n`);
  
  let videoCount = 0;
  let clipCount = 0;
  
  for (const videoDir of videoDirs) {
    const videoPath = path.join(OUTPUT_DIR, videoDir);
    const analysisPath = path.join(videoPath, 'analysis', 'simple_director_analysis.json');
    const clipsPath = path.join(videoPath, 'clips');
    
    // Skip if no analysis
    if (!fs.existsSync(analysisPath)) {
      console.log(`⏭️  Skipping ${videoDir} (no analysis)`);
      continue;
    }
    
    console.log(`📹 ${videoDir}`);
    
    // Parse analysis
    const analysis = parseAnalysis(analysisPath);
    if (!analysis) {
      console.log(`   ⚠️ Could not parse analysis`);
      continue;
    }
    
    // Extract video metadata
    const summary = extractSummary(analysis.video_analysis.synthesis_text);
    const characters = extractCharacters(analysis.video_analysis.synthesis_text);
    const durationSeconds = Math.round(analysis.video_analysis.total_duration_minutes * 60);
    
    // Determine processing status based on word count
    const transcriptPath = path.join(videoPath, 'analysis', 'full_transcript.txt');
    let wordCount = 0;
    let status = 'partial';
    if (fs.existsSync(transcriptPath)) {
      const transcript = fs.readFileSync(transcriptPath, 'utf-8');
      wordCount = transcript.split(/\s+/).length;
      status = wordCount > 500 ? 'full' : 'partial';
    }
    
    // Insert video
    const { data: videoData, error: videoError } = await supabase
      .from('videos')
      .upsert({
        title: videoDir.replace(/_/g, ' ').replace(/-/g, ' - '),
        filename: videoDir,
        duration_seconds: durationSeconds,
        summary: summary,
        characters: characters,
        transcript_word_count: wordCount,
        processing_status: status
      }, { onConflict: 'filename' })
      .select()
      .single();
    
    if (videoError) {
      console.log(`   ❌ Error inserting video:`, videoError.message);
      continue;
    }
    
    const videoId = videoData.id;
    videoCount++;
    console.log(`   ✓ Video inserted (${status}, ${wordCount} words)`);
    
    // Link video to acts
    const actNumbers = videoActMapping[videoDir] || [2]; // Default to Act II
    for (const actNum of actNumbers) {
      const actId = actIds[actNum];
      if (actId) {
        await supabase.from('video_acts').upsert({
          video_id: videoId,
          act_id: actId,
          priority: actNumbers.indexOf(actNum) === 0 ? 1 : 2
        }, { onConflict: 'video_id,act_id' });
      }
    }
    
    // Process clips
    if (fs.existsSync(clipsPath)) {
      const clipFiles = fs.readdirSync(clipsPath).filter(f => f.endsWith('.mp4'));
      
      for (const clipFile of clipFiles) {
        const clipName = path.basename(clipFile, '.mp4');
        const safeFilename = `${videoDir}__${clipName}`;
        
        // Check if optimized clip exists
        const optimizedPath = path.join(WEB_CLIPS_DIR, `${safeFilename}.mp4`);
        const thumbPath = path.join(THUMBS_DIR, `${safeFilename}.jpg`);
        
        let storagePath = null;
        let thumbnailPath = null;
        
        // Upload optimized clip if it exists
        if (fs.existsSync(optimizedPath)) {
          storagePath = await uploadFile(optimizedPath, 'clips', `${safeFilename}.mp4`);
        }
        
        // Upload thumbnail if it exists
        if (fs.existsSync(thumbPath)) {
          thumbnailPath = await uploadFile(thumbPath, 'thumbnails', `${safeFilename}.jpg`);
        }
        
        // Insert clip
        const { error: clipError } = await supabase
          .from('clips')
          .upsert({
            video_id: videoId,
            title: clipName.replace(/-/g, ' '),
            filename: clipFile,
            storage_path: storagePath,
            thumbnail_path: thumbnailPath,
            sort_order: parseInt(clipName.match(/^(\d+)/)?.[1] || '0')
          }, { onConflict: 'video_id,filename' });
        
        if (!clipError) {
          clipCount++;
        }
      }
      console.log(`   ✓ ${clipFiles.length} clips processed`);
    }
  }
  
  console.log(`\n✅ Migration complete!`);
  console.log(`   Videos: ${videoCount}`);
  console.log(`   Clips: ${clipCount}`);
}

main().catch(console.error);

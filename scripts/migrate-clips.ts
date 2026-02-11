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

// Video to Act mapping - maps video directory names to act numbers
// Uses fuzzy matching to handle naming variations
function getActsForVideo(videoDir: string): number[] {
  const name = videoDir.toLowerCase();
  
  // ACT I - The Dream (coal mining origins, early vision)
  if (name.includes('coal') || name.includes('mining') || name.includes('joung')) return [1];
  if (name.includes('narrated_by_harris')) return [1];
  
  // ACT III - The Arrival (opening, tournaments, awards)
  if (name.includes('opening') || name.includes('grand_open')) return [3];
  if (name.includes('classic') || name.includes('nationwide')) return [3];
  if (name.includes('citizen_of_the_year') || name.includes('award')) return [3];
  if (name.includes('cbs_promo')) return [3];
  if (name.includes('disc_i') || name.includes('disc_iii')) return [3];
  
  // Interview with Pete Dye spans acts
  if (name.includes('interview') && name.includes('pete_dye')) return [1, 2];
  
  // Highlights compilation spans all acts
  if (name.includes('highlights') && name.includes('interviews')) return [1, 2, 3];
  
  // ACT II - The Struggle (construction, parties, events during building)
  // Default to Act 2 for most footage
  return [2];
}

interface VideoAnalysis {
  video_analysis: {
    // New structured format (GPT-5.1)
    title?: string;
    content_type?: string;
    summary?: string;
    characters?: Array<{ name: string; role: string; description: string; is_speaking: boolean }>;
    chapters?: Array<{ title: string; start_time: string; end_time: string; summary: string; characters_present: string[] }>;
    highlights?: Array<{ title: string; timestamp: string; description: string; emotional_tone: string; characters_involved: string[] }>;
    quotes?: Array<{ text: string; speaker: string; timestamp: string; context: string }>;
    themes?: string[];
    // Old format fallback
    synthesis_text?: string;
    total_segments?: number;
    total_duration_minutes?: number;
  };
  raw_segments?: Array<{
    segment_id: number;
    timestamp_range: string;
  }>;
  processing_metadata?: {
    processing_time_seconds?: number;
    total_processing_time_minutes?: number;
  };
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/\u2011/g, '-').replace(/\u2013/g, '-').replace(/\u2014/g, '-')
    .replace(/'/g, '').replace(/"/g, '').replace(/\u2019/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9_\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
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
    
    // Check if we have clips
    const hasClips = fs.existsSync(clipsPath) && fs.readdirSync(clipsPath).filter(f => f.endsWith('.mp4')).length > 0;
    
    // Skip if no analysis AND no clips
    if (!fs.existsSync(analysisPath) && !hasClips) {
      console.log(`⏭️  Skipping ${videoDir} (no analysis or clips)`);
      continue;
    }
    
    console.log(`📹 ${videoDir}`);
    
    // Parse analysis (may not exist)
    const analysis = fs.existsSync(analysisPath) ? parseAnalysis(analysisPath) : null;
    
    // Extract video metadata - prefer new structured format, fall back to old
    let videoTitle = videoDir.replace(/_/g, ' ').replace(/-/g, ' - ');
    let summary = '';
    let characters: string[] = [];
    let durationSeconds = 0;
    let chapters: object[] = [];
    let highlights: string[] = [];
    
    if (analysis) {
      const va = analysis.video_analysis;
      if (va.title) {
        // New structured format (GPT-5.1)
        videoTitle = va.title;
        summary = va.summary || '';
        characters = (va.characters || []).map(c => c.name);
        chapters = va.chapters || [];
        highlights = (va.highlights || []).map(h => h.title);
      } else if (va.synthesis_text) {
        // Old format fallback
        summary = extractSummary(va.synthesis_text);
        characters = extractCharacters(va.synthesis_text);
      }
      durationSeconds = Math.round((va.total_duration_minutes || analysis.processing_metadata?.total_processing_time_minutes || 0) * 60);
    }
    
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
        title: videoTitle,
        filename: videoDir,
        duration_seconds: durationSeconds,
        summary: summary,
        characters: characters,
        chapters: chapters as any,
        highlights: highlights,
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
    const actNumbers = getActsForVideo(videoDir);
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
        const safeFilename = `${sanitizeFilename(videoDir)}__${sanitizeFilename(clipName)}`;
        
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
        
        // Insert clip - use descriptive name from chapter title
        const clipTitle = clipName
          .replace(/^\d+-/, '')  // Remove leading number
          .replace(/-/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        const { error: clipError } = await supabase
          .from('clips')
          .upsert({
            video_id: videoId,
            title: clipTitle || clipName,
            filename: `${safeFilename}.mp4`,
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

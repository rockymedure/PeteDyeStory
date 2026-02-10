import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Load env from web/.env.local (same approach as populate-clip-descriptions.ts)
const envPath = '/Users/rockymedure/Desktop/PeteDyeStory/web/.env.local';
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach((line) => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env.local');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const badGovernorRegex =
  /\b(?:gov\.?|governor)\s+bill\s+clinton\b/gi;

const replacement = 'West Virginia Governor Gaston Caperton';

function fixText(text: string): { updated: string; changed: boolean } {
  const updated = text.replace(badGovernorRegex, replacement);
  return { updated, changed: updated !== text };
}

async function fixClips() {
  const { data: clips, error } = await supabase
    .from('clips')
    .select('id, title, filename, description')
    .or('description.ilike.%clinton%,title.ilike.%clinton%')
    .limit(1000);

  if (error) throw error;
  if (!clips || clips.length === 0) return { scanned: 0, updated: 0 };

  let updatedCount = 0;

  for (const clip of clips as Array<{ id: string; title: string | null; filename: string; description: string | null }>) {
    if (!clip.description) continue;
    const { updated, changed } = fixText(clip.description);
    if (!changed) continue;

    const { error: updateError } = await supabase
      .from('clips')
      .update({ description: updated })
      .eq('id', clip.id);

    if (updateError) throw updateError;
    updatedCount++;
    // eslint-disable-next-line no-console
    console.log(`✓ clip: ${clip.filename} — fixed governor name`);
  }

  return { scanned: clips.length, updated: updatedCount };
}

async function fixVideos() {
  const { data: videos, error } = await supabase
    .from('videos')
    .select('id, filename, title, summary')
    .or('summary.ilike.%clinton%,title.ilike.%clinton%')
    .limit(1000);

  if (error) throw error;
  if (!videos || videos.length === 0) return { scanned: 0, updated: 0 };

  let updatedCount = 0;

  for (const video of videos as Array<{ id: string; filename: string; title: string | null; summary: string | null }>) {
    if (!video.summary) continue;
    const { updated, changed } = fixText(video.summary);
    if (!changed) continue;

    const { error: updateError } = await supabase
      .from('videos')
      .update({ summary: updated })
      .eq('id', video.id);

    if (updateError) throw updateError;
    updatedCount++;
    // eslint-disable-next-line no-console
    console.log(`✓ video: ${video.filename} — fixed governor name`);
  }

  return { scanned: videos.length, updated: updatedCount };
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('Scanning Supabase for “Governor Bill Clinton” text…');

  const [clips, videos] = await Promise.all([fixClips(), fixVideos()]);

  // eslint-disable-next-line no-console
  console.log(
    `Done.\n- Clips scanned: ${clips.scanned}, updated: ${clips.updated}\n- Videos scanned: ${videos.scanned}, updated: ${videos.updated}`
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

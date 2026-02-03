/**
 * Sync clips to database - generates SQL for MCP execution
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_CLIPS_DIR = '/Users/rockymedure/Desktop/PeteDyeStory/web-clips';

// Video ID mappings from database (with underscore versions)
const videoIds: Record<string, string> = {
  '12_15_89___LaRosa_Annual_Christmas_Party': '561e1d14-0559-4650-8c25-334dfee12515',
  '9_1_90_Friends_of_James_D__s_Dinner_at_Nona_Maria_s_Pool_at_Jimmy_Joe_s_House': '1eb28449-0477-4814-a9bf-dd013cc3b7f0',
  'Aug_1985_PDGC_Construction_Cleaning_out_Simpson_Creek': 'f4809a22-6227-4eea-93bc-30f4125e02ea',
  'Disc_III_Pete_Dye_WV_Classic_July_15_16_2004': '454657ba-189f-45c6-b4f8-0d9873345a59',
  'Disc_I__Pete_Dye_WV_Classic_July_15_16_2004_020': '9a7530e3-6b52-4fdc-b678-631e6080da61',
  'Harrison_Co__Chamber_of_Commerce_Citizen_of_the_Year_Award_1995_Presented_to_James_D__LaRosa_006': '17c60b08-768b-44c1-a9d3-20049c147958',
  'Highlites_of_the_Pete_Dye___LaRosa_Flof_Course_10_89_thru_10_90_James_D_s_cats_and_Dogs': '98249191-1958-48ee-8d7d-02cd3a5be1e3',
  'Interview_With_Pete_Dye_7_10_94': '31b1b147-d8ed-44c9-829b-b04ee0d8f3c8',
  'Joe_Dimaggio_Special_Guest_At_the_PDBC': 'c9c706aa-4b51-4d2e-b039-c4a32c6c229c',
  'Joung_JJL_Coal_Mining_Footage_No_Sound': '00bb81ec-9f24-4fc3-9f56-c92993671000',
  'Oct__1992_thru_Dec__1992': 'd8a83b3e-e987-4801-8f52-fdcd77bce979',
  'Papa_Jim_Interview_Eastpointe_Shopping_Cneter_Blast': '4238cbc8-bc56-4df9-92d1-c3a20b074c01',
  'PDGC_1994_Opening_of_the_back_nine_Bember_Guest': '56192204-5fb4-41d5-b54c-1dc519b03484',
  'PDGC_Construction_8_31_93_thru_7_7_94_012': '093ac118-df9b-4df7-a53a-6b5cbfcc9c71',
  'PDGC_Grand_Opening': '66cec577-4a28-40e4-ab9f-8badc8635f01',
  'PDGC_Member_Guest_Dinner___Dnace_at_Green_Acres_8_21_1993': 'cdd6c004-da33-43be-847d-5686f9f7c871',
  'PDGC_Opening_7_3_1993': '656fa972-fab1-4bc5-98d7-d632204c1d49',
  'Pete_Dye_Golf_Club': 'ee789e73-9d34-4f02-af26-d1e4b17042ad',
  'Pete_Dye_Golf_Club_4_27_91_thru_10_10_91_Holes_1_thru_9': '2db275cf-23f9-44c5-a0d2-8a1dad536d7c',
  'Pete_Dye_Golf_Club_9_5_92_thru_7_1_93_008': '60f6bb08-dfd7-4c45-ab9d-1231b7e147ef',
  'Pete_Dye_Golf_Club_9_9_1992': 'd334c381-0882-437e-a202-396838bd3885',
  'Pete_Dye_Golf_Club_Spring_1989': '88e7e018-dcc0-41f5-81f0-e71d9d955f6d',
  'Pete_Dye_Golf_Course_10_16_90_thru_6_14_91': '3751ac90-567a-450c-9d4f-26906e488a35',
  'Pete_Dye_Golf_Course_10_9_90_thru_11_3_90': '7f0be4bb-2833-4973-b3ad-fa3fcfb2bb4e',
  'Pete_Dye_Golf_Course_Construction_6_18_1987_thru_10_6_1987': 'e053da99-3a66-4141-89b4-fae8230775c7',
  'Pete_Dye_Golf_Course_Highlights_And_Interviews__2__002': '6a7899c1-9f30-4c19-a289-27302afc0bb9',
  'Pete_Dye_WV_Classic_Nationwide_Tour_July_15_16_2004_019': '8c6b1eb3-5938-4575-92a0-fa578433eb58',
  'Some_Highlites_of_the_Pete_Dye___LaRosa_Golf_Course_Aug__1982_1988__2__009': 'e6902f2f-462c-4463-bb60-e6a301b10a50',
  'The_Pete_Dye_Golf_Course_Narrated_by_Harris_Holt': 'f13623f7-6e40-4479-8c3b-af85eea6556e',
};

function normalizeVideoName(name: string): string {
  // Normalize hyphens to underscores for matching
  return name.replace(/-/g, '_');
}

function findVideoId(clipVideoName: string): string | null {
  // Direct match first
  if (videoIds[clipVideoName]) return videoIds[clipVideoName];
  
  // Try normalized match
  const normalized = normalizeVideoName(clipVideoName);
  for (const [key, id] of Object.entries(videoIds)) {
    if (normalizeVideoName(key) === normalized) return id;
  }
  
  return null;
}

async function main() {
  const clipFiles = fs.readdirSync(WEB_CLIPS_DIR).filter(f => f.endsWith('.mp4'));
  
  console.log(`Found ${clipFiles.length} clips to sync\n`);
  
  const inserts: string[] = [];
  const missingVideos = new Set<string>();
  
  for (const clipFile of clipFiles) {
    const safeName = path.basename(clipFile, '.mp4');
    
    // Parse: VideoName__ClipName
    const parts = safeName.split('__');
    if (parts.length < 2) {
      console.log(`Skipping invalid filename: ${clipFile}`);
      continue;
    }
    
    const videoName = parts.slice(0, -1).join('__');
    const clipName = parts[parts.length - 1];
    const sortOrder = parseInt(clipName.match(/^(\d+)/)?.[1] || '0');
    
    const videoId = findVideoId(videoName);
    if (!videoId) {
      missingVideos.add(videoName);
      continue;
    }
    
    // Escape single quotes in title
    const title = clipName.replace(/-/g, ' ').replace(/'/g, "''");
    const filename = `${clipName}.mp4`;
    
    inserts.push(`('${videoId}', '${title}', '${filename}', ${sortOrder})`);
  }
  
  if (missingVideos.size > 0) {
    console.log('Videos not found in DB:');
    missingVideos.forEach(v => console.log(`  - ${v}`));
    console.log('');
  }
  
  // Generate SQL
  const sql = `
-- Clear existing clips and re-insert
DELETE FROM clips;

-- Insert all clips
INSERT INTO clips (video_id, title, filename, sort_order)
VALUES
${inserts.join(',\n')};
`;
  
  console.log(`Generated SQL for ${inserts.length} clips`);
  fs.writeFileSync('/tmp/insert_clips.sql', sql);
  console.log('SQL written to /tmp/insert_clips.sql');
}

main().catch(console.error);

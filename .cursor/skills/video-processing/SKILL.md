---
name: video-processing
description: Process Pete Dye construction videos to extract transcripts, chapters, characters, highlights, and video clips. Use when the user wants to analyze a video, get a transcript, extract chapters, identify speakers, pull out specific clips, or process footage for the documentary.
---

# Video Processing

Multimodal video analysis for Pete Dye Golf Club footage using OpenAI (GPT-4o).

## Quick Start

```bash
cd /Users/rockymedure/Desktop/PeteDyeStory/video-processing
source venv/bin/activate
python run_video.py media/VIDEO_FILE.mp4
```

## Setup (one-time)

```bash
cd /Users/rockymedure/Desktop/PeteDyeStory/video-processing
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

API key is already configured in `.env`.

## Processing a Video

1. Place video in `video-processing/media/`
2. Run: `python run_video.py media/FILENAME.mp4`
3. Optional: specify segment duration (default 150s): `python run_video.py media/FILENAME.mp4 300`

## Output Location

Results saved to `video-processing/output/<video_name>/analysis/`:

| File | Contents |
|------|----------|
| `simple_director_analysis.md` | Human-readable report with summary, chapters, highlights |
| `simple_director_analysis.json` | Machine-readable structured data |
| `full_transcript.txt` | Complete audio transcript |

## Output Structure (JSON)

```json
{
  "video_analysis": {
    "synthesis_text": "Summary, characters, chapters, highlights...",
    "total_segments": 12
  },
  "processing_metadata": {
    "total_processing_time_minutes": 5.2,
    "speed_improvement": "15x faster than realtime"
  }
}
```

## Integration with Project

The output feeds into:
- `posts/` - Blog post content and quotes
- `FILM-OUTLINE.md` - Documentary structure and scenes
- Character documentation and timeline

## What It Extracts

- **Summary**: 2-3 sentence overview of video content
- **Characters**: People who appear (Pete Dye, workers, etc.)
- **Chapters**: Natural story progression with timestamps
- **Highlights**: Memorable moments with context
- **Full Transcript**: Word-level accurate transcription

## Extracting Clips from Highlights

After analysis completes, extract video clips based on identified highlights.

### Clip Extraction Process

1. **Review the analysis** to identify key moments from `simple_director_analysis.md`
2. **Find timestamps** in the transcript or segment data
3. **Extract clips** using ffmpeg:

```bash
VIDEO="/path/to/original/video.mp4"
CLIPS="video-processing/output/<video_name>/clips"
mkdir -p "$CLIPS"

# Extract a clip (start time, duration)
ffmpeg -i "$VIDEO" -ss 00:10:00 -t 00:03:00 -c:v libx264 -c:a aac "$CLIPS/clip-name.mp4"
```

### FFmpeg Parameters

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `-ss` | Start time | `00:10:30` (10 min 30 sec) |
| `-t` | Duration | `00:03:00` (3 minutes) |
| `-to` | End time (alternative to -t) | `00:13:30` |
| `-c:v libx264` | Video codec | H.264 for compatibility |
| `-c:a aac` | Audio codec | AAC for compatibility |

### Clip Output Location

Clips are saved to:
```
video-processing/output/<video_name>/clips/
├── 01-descriptive-name.mp4
├── 02-another-moment.mp4
└── 03-key-scene.mp4
```

### Naming Convention

Use numbered prefixes with descriptive names:
- `01-halloween-costumes-1992.mp4`
- `02-pete-dye-site-visit.mp4`
- `03-grand-opening-ceremony.mp4`

### Example: Extract Multiple Clips

```bash
VIDEO="/Users/rockymedure/Downloads/Construction-1989.mp4"
CLIPS="video-processing/output/Construction_1989/clips"
mkdir -p "$CLIPS"

# Pete arrives on site (5:00 - 8:00)
ffmpeg -i "$VIDEO" -ss 00:05:00 -t 00:03:00 -c:v libx264 -c:a aac -y "$CLIPS/01-pete-arrives.mp4"

# Workers shaping bunker (22:30 - 25:00)
ffmpeg -i "$VIDEO" -ss 00:22:30 -t 00:02:30 -c:v libx264 -c:a aac -y "$CLIPS/02-bunker-shaping.mp4"

# Sunset over course (1:15:00 - 1:17:00)
ffmpeg -i "$VIDEO" -ss 01:15:00 -t 00:02:00 -c:v libx264 -c:a aac -y "$CLIPS/03-sunset-beauty-shot.mp4"
```

### Finding Timestamps

1. **From segment analysis**: Each segment has a `timestamp_range` field
2. **From transcript**: Search `full_transcript.txt` for keywords
3. **From highlights**: The synthesis identifies memorable moments

```bash
# Search transcript for keywords
grep -i "pete\|bunker\|opening" output/<video>/analysis/full_transcript.txt

# Find segment timestamps
grep "timestamp_range" output/<video>/analysis/simple_director_analysis.json
```

## Troubleshooting

**FFmpeg not found**: `brew install ffmpeg`

**API error**: Check `.env` file has valid `OPENAI_API_KEY`

**Video format issues**: Convert with `ffmpeg -i input.mov output.mp4`

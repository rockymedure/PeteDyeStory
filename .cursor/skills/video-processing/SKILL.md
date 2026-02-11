---
name: video-processing
description: Process Pete Dye construction videos to extract transcripts, chapters, characters, highlights, and video clips. Use when the user wants to analyze a video, get a transcript, extract chapters, identify speakers, pull out specific clips, or process footage for the documentary.
---

# Video Processing

Multimodal video analysis for Pete Dye Golf Club footage using OpenAI GPT-5.1.

## Quick Start

```bash
cd /Users/rockymedure/Desktop/PeteDyeStory/video-processing
source venv/bin/activate
python run_video.py media/VIDEO_FILE.mp4
```

## CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--model gpt-5.1` | AI model for vision + synthesis | `gpt-5.1` |
| `--model gpt-4o` | Legacy model | - |
| `--skip-diarization` | Skip speaker diarization (no-speech videos) | off |
| `--segment-duration N` | Seconds per video segment | `150` |
| `--reprocess` | Force re-analysis even if output exists | off |

### Examples

```bash
# Standard analysis (GPT-5.1, 2.5-min segments)
python run_video.py media/construction_footage.mp4

# Legacy model
python run_video.py media/old_video.mp4 --model gpt-4o

# Silent footage (no speech to diarize)
python run_video.py media/timelapse.mp4 --skip-diarization

# Longer segments for very long videos
python run_video.py media/full_day.mp4 --segment-duration 300

# Re-analyze a previously processed video
python run_video.py media/construction_footage.mp4 --reprocess
```

## Setup (one-time)

```bash
cd /Users/rockymedure/Desktop/PeteDyeStory/video-processing
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

API key is already configured in `.env`.

Required system dependency: `brew install ffmpeg`

## Models Used

| Model | Purpose |
|-------|---------|
| **GPT-5.1** | Vision analysis of video frames + final synthesis |
| **gpt-4o-transcribe** | Audio-to-text transcript generation |
| **gpt-4o-transcribe-diarize** | Speaker diarization (who said what) |
| **whisper-1** | Word-level timestamp alignment |

## Output Location

Results saved to `video-processing/output/<video_name>/analysis/`:

| File | Contents |
|------|----------|
| `simple_director_analysis.json` | Structured data (see schema below) |
| `simple_director_analysis.md` | Human-readable report |
| `full_transcript.txt` | Complete audio transcript |

## Output Structure (JSON)

```json
{
  "video_analysis": {
    "title": "Construction Day 47 - Bunker Shaping",
    "content_type": "construction_footage",
    "summary": "Pete Dye supervises bunker shaping on hole 14...",
    "characters": [
      {
        "name": "Pete Dye",
        "is_speaking": true,
        "description": "Lead architect, directing bunker placement"
      }
    ],
    "chapters": [
      {
        "title": "Morning Setup",
        "start_time": "00:00:00",
        "end_time": "00:05:30",
        "summary": "Crew arrives and reviews the day's plan"
      }
    ],
    "highlights": [
      {
        "timestamp": "00:12:45",
        "description": "Pete Dye walks into the bunker to demonstrate the slope"
      }
    ],
    "quotes": [
      {
        "speaker": "Pete Dye",
        "text": "Make it look natural, like God put it there.",
        "timestamp": "00:15:20"
      }
    ],
    "themes": ["bunker_design", "hands_on_leadership", "craftsmanship"]
  },
  "processing_metadata": {
    "total_processing_time_minutes": 5.2,
    "model": "gpt-5.1",
    "segments_processed": 12
  }
}
```

## Character Knowledge Base

The file `video-processing/characters.json` contains known people across all videos. The analysis pipeline uses this to identify recurring characters consistently. Update this file when new people are identified.

## Cross-Video Synthesis

After processing multiple videos, generate a cross-video synthesis that connects themes, characters, and timeline across all footage:

```bash
python cross_video_synthesis.py
```

This reads all `simple_director_analysis.json` files from `output/` and produces a unified timeline and character map.

## Batch Processing

Process multiple videos from a queue file (`video_queue.txt`):

```bash
# Standard batch run
python batch_processor.py

# Force re-analysis of all videos (even already-processed ones)
python batch_processor.py --reprocess
```

Features:
- Reads video list from `video_queue.txt` (one filename per line, `#` comments supported)
- Skips already-processed videos unless `--reprocess` is set
- Exponential backoff on rate limit errors (60s -> 120s -> 240s, max 3 retries)
- 2-hour timeout per video
- Automatic validation after each video
- Clip extraction (up to 10 per video)
- Summary report written to `batch_summary.md`

## Clip Extraction

After analysis completes, clips are automatically extracted from identified highlights. You can also extract manually:

### Manual Clip Extraction

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

### Finding Timestamps

1. **From chapters**: Each chapter has `start_time` and `end_time`
2. **From highlights**: Each highlight has a `timestamp`
3. **From transcript**: Search `full_transcript.txt` for keywords
4. **From quotes**: Each quote has a `timestamp`

## Troubleshooting

**FFmpeg not found**: `brew install ffmpeg`

**API error**: Check `.env` file has valid `OPENAI_API_KEY`

**Video format issues**: Convert with `ffmpeg -i input.mov output.mp4`

**Rate limit errors**: The batch processor handles this automatically with exponential backoff. For single video runs, wait a few minutes and retry.

**Empty transcript**: Some construction footage has no audio. Use `--skip-diarization` flag for these videos.

**Timeout on long videos**: Increase segment duration with `--segment-duration 300` to reduce the number of API calls.

**Old format output**: Run with `--reprocess` to regenerate output with the current structured schema (title, characters, chapters, etc.).

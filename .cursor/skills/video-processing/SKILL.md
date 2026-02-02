---
name: video-processing
description: Process Pete Dye construction videos to extract transcripts, chapters, characters, and highlights. Use when the user wants to analyze a video, get a transcript, extract chapters, identify speakers, or process footage for the documentary.
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

## Troubleshooting

**FFmpeg not found**: `brew install ffmpeg`

**API error**: Check `.env` file has valid `OPENAI_API_KEY`

**Video format issues**: Convert with `ffmpeg -i input.mov output.mp4`

# 🎬 Pete Dye Story - Video Processing

Multimodal video analysis system for processing Pete Dye Golf Club construction footage.

## Overview

This system transforms raw video footage into structured, searchable content:
- **Complete audio transcription** (word-level accuracy with OpenAI)
- **Visual scene analysis** (frame-by-frame with GPT-4o Vision)
- **Character identification** (who appears and when)
- **Chapter breakdown** (natural story progression with timestamps)
- **Highlights extraction** (memorable moments)

**Performance**: Processes video ~10-15x faster than realtime

**Simplified Setup**: Only requires an OpenAI API key (no Grok/xAI needed)

## Quick Start

### 1. Setup

```bash
# Navigate to video-processing folder
cd video-processing

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install FFmpeg (if not already installed)
brew install ffmpeg
```

### 2. Set API Key

Your OpenAI API key is already in the `.env` file. Or set as environment variable:

```bash
export OPENAI_API_KEY="your-openai-key"
```

### 3. Run Analysis

```bash
# Analyze a video
python run_video.py media/your_video.mp4

# Or with custom segment duration (in seconds)
python run_video.py media/your_video.mp4 300
```

## Output

Results are saved to `output/<video_name>/analysis/`:

```
output/
└── your_video/
    └── analysis/
        ├── simple_director_analysis.json   # Machine-readable data
        ├── simple_director_analysis.md     # Human-readable report
        └── full_transcript.txt             # Complete audio transcript
```

### Output Contents

**JSON Analysis** includes:
- Summary of video content
- Characters and their appearances
- Chapter breakdown with timestamps
- Highlights and memorable moments
- Processing metadata

**Markdown Report** includes:
- Formatted summary
- Easy-to-read chapter breakdown
- Processing statistics

## How It Works

### 4-Phase Pipeline

```
Phase 1: AUDIO
├── Extract full audio from video
└── Transcribe with OpenAI (gpt-4o-transcribe + whisper-1)

Phase 2: SEGMENTATION
├── Split video into 2.5-minute chunks
└── Prepare for parallel visual processing

Phase 3: VISUAL ANALYSIS (Parallel)
├── Extract frames every 4 seconds
├── Analyze each segment with Grok-4 Vision
└── Cross-reference with audio transcript

Phase 4: SYNTHESIS
├── Combine all segment analyses
├── Generate summary, chapters, highlights
└── Save structured output
```

### Key Technologies

- **OpenAI GPT-4o-transcribe**: High-quality audio transcription
- **OpenAI Whisper-1**: Word-level timestamps
- **OpenAI GPT-4o Vision**: Visual scene understanding
- **AsyncIO**: Parallel segment processing
- **FFmpeg**: Video/audio extraction

## Folder Structure

```
video-processing/
├── run_video.py              # Main entry point
├── requirements.txt          # Python dependencies
├── README.md                 # This file
├── scripts/
│   ├── simple_director.py    # Orchestrator (4-phase pipeline)
│   └── fast_multimodal_transcript.py  # Processing engine
├── media/                    # Put your videos here
├── output/                   # Analysis results (auto-created)
├── segments/                 # Temp files (auto-cleaned)
└── test/                     # Test videos
```

## Tips

### Processing Long Videos

- Default segment duration is 150 seconds (2.5 minutes)
- For very long videos (2+ hours), you can increase to 300 seconds
- The system handles any video length through intelligent segmentation

### API Costs

- **OpenAI Audio**: ~$0.10-0.20 per hour of audio
- **OpenAI Vision**: ~$0.50-1.00 per hour of video (varies by frame count)

### Troubleshooting

**FFmpeg not found:**
```bash
brew install ffmpeg
```

**API key errors:**
```bash
# Check key is set
echo $OPENAI_API_KEY
# Or check .env file exists
cat .env
```

**Video format issues:**
- Supported: MP4, MOV, AVI, MKV, WMV
- If issues, convert with: `ffmpeg -i input.mov output.mp4`

## Integration with Pete Dye Story

The output from video analysis feeds directly into:
- Blog post content (`posts/`)
- Film outline (`FILM-OUTLINE.md`)
- Character documentation
- Timeline construction

---

*Part of the Pete Dye Story project*
*Original system: Louie (September 2024)*

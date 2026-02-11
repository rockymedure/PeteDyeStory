#!/usr/bin/env python3
"""
Pete Dye Story - Video Analysis Runner

Usage:
    python run_video.py path/to/your/video.mp4
    python run_video.py path/to/video.mp4 --model gpt-5.1
    python run_video.py path/to/video.mp4 --skip-diarization
    python run_video.py path/to/video.mp4 --segment-duration 300

Requirements:
    - OPENAI_API_KEY in .env file or environment
    - Install dependencies: pip install -r requirements.txt
    - Install FFmpeg: brew install ffmpeg
"""

import argparse
import asyncio
import sys
import os

# Load .env file if it exists
def load_env():
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    if key and value and key not in os.environ:
                        os.environ[key] = value

load_env()

# Add scripts folder to path
scripts_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts')
sys.path.append(scripts_path)

from simple_director import SimpleDirector


def print_usage():
    print("""
Pete Dye Story - Video Analysis Tool

USAGE:
    python run_video.py <video_path> [options]

ARGUMENTS:
    video_path              Path to the video file (MP4, MOV, etc.)

OPTIONS:
    --segment-duration N    Seconds per segment (default: 150 = 2.5 minutes)
    --model MODEL           AI model: gpt-5.1 (default) or gpt-4o (legacy)
    --skip-diarization      Skip speaker diarization for videos with no speech
    --reprocess             Force re-analysis even if output already exists

EXAMPLES:
    python run_video.py media/construction_footage.mp4
    python run_video.py media/pete_interview.mp4 --segment-duration 300
    python run_video.py media/silent_footage.mp4 --skip-diarization
    python run_video.py media/old_analysis.mp4 --reprocess

SETUP:
    1. Add your OpenAI API key to .env file:
       OPENAI_API_KEY=sk-your-key-here

    2. Or set as environment variable:
       export OPENAI_API_KEY="your-openai-key"

    3. Install dependencies:
       pip install -r requirements.txt

    4. Install FFmpeg:
       brew install ffmpeg

OUTPUT:
    Results are saved to: output/<video_name>/analysis/
    - simple_director_analysis.json  (structured data)
    - simple_director_analysis.md    (human-readable report)
    - full_transcript.txt            (complete audio transcript)
""")


async def run_analysis(video_path: str, segment_duration: int = 150,
                       model: str = 'gpt-5.1', skip_diarization: bool = False,
                       reprocess: bool = False):
    """Run video analysis on the specified file"""
    
    # Check for API key
    openai_api_key = os.environ.get('OPENAI_API_KEY')

    if not openai_api_key:
        print("Error: OPENAI_API_KEY not found")
        print("   Add it to .env file or set as environment variable:")
        print("   export OPENAI_API_KEY='your-key'")
        return None

    # Check video file exists
    if not os.path.exists(video_path):
        print(f"Error: Video file not found: {video_path}")
        return None

    # Get video file info
    file_size_mb = os.path.getsize(video_path) / (1024 * 1024)
    print(f"Video: {video_path}")
    print(f"Size: {file_size_mb:.1f} MB")
    print(f"Segment duration: {segment_duration} seconds ({segment_duration/60:.1f} minutes)")
    print(f"Model: {model}")
    if skip_diarization:
        print(f"Diarization: SKIPPED")
    if reprocess:
        print(f"Mode: REPROCESS (forcing re-analysis)")
    print()

    # Initialize director with model and diarization options
    base_dir = os.path.dirname(os.path.abspath(__file__))
    director = SimpleDirector(
        openai_api_key,
        base_dir=base_dir,
        model=model,
        skip_diarization=skip_diarization
    )

    # Run analysis
    result = await director.analyze_video(video_path, segment_duration=segment_duration)

    return result


def main():
    parser = argparse.ArgumentParser(description='Pete Dye Story - Video Analysis Tool')
    parser.add_argument('video_path', help='Path to the video file')
    parser.add_argument('--segment-duration', type=int, default=150, help='Seconds per segment (default: 150)')
    parser.add_argument('--model', choices=['gpt-4o', 'gpt-5.1'], default='gpt-5.1', help='AI model to use (default: gpt-5.1)')
    parser.add_argument('--skip-diarization', action='store_true', help='Skip speaker diarization for videos with no speech')
    parser.add_argument('--reprocess', action='store_true', help='Force re-analysis even if output already exists')
    args = parser.parse_args()

    # Run the analysis
    print("PETE DYE STORY - VIDEO ANALYSIS")
    print("=" * 50)
    
    result = asyncio.run(run_analysis(
        args.video_path,
        segment_duration=args.segment_duration,
        model=args.model,
        skip_diarization=args.skip_diarization,
        reprocess=args.reprocess
    ))
    
    if result:
        print("\n" + "=" * 50)
        print("ANALYSIS COMPLETE!")
        print("=" * 50)
    else:
        print("\nAnalysis failed. Check the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()

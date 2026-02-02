#!/usr/bin/env python3
"""
Pete Dye Story - Video Analysis Runner

Usage:
    python run_video.py path/to/your/video.mp4

Requirements:
    - Set OPENAI_API_KEY and GROK_API_KEY environment variables
    - Install dependencies: pip install -r requirements.txt
    - Install FFmpeg: brew install ffmpeg
"""

import asyncio
import sys
import os

# Add scripts folder to path
scripts_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scripts')
sys.path.append(scripts_path)

from simple_director import SimpleDirector


def print_usage():
    print("""
🎬 Pete Dye Story - Video Analysis Tool

USAGE:
    python run_video.py <video_path> [segment_duration]

ARGUMENTS:
    video_path        Path to the video file (MP4, MOV, etc.)
    segment_duration  Optional: Seconds per segment (default: 150 = 2.5 minutes)

EXAMPLES:
    python run_video.py media/construction_footage.mp4
    python run_video.py media/pete_interview.mp4 300

SETUP:
    1. Set API keys:
       export OPENAI_API_KEY="your-openai-key"
       export GROK_API_KEY="your-xai-key"

    2. Install dependencies:
       pip install -r requirements.txt

    3. Install FFmpeg:
       brew install ffmpeg

OUTPUT:
    Results are saved to: output/<video_name>/analysis/
    - simple_director_analysis.json  (machine-readable)
    - simple_director_analysis.md    (human-readable report)
    - full_transcript.txt            (complete audio transcript)
""")


async def run_analysis(video_path: str, segment_duration: int = 150):
    """Run video analysis on the specified file"""
    
    # Check for API keys
    openai_api_key = os.environ.get('OPENAI_API_KEY')
    grok_api_key = os.environ.get('GROK_API_KEY')

    if not openai_api_key:
        print("❌ Error: OPENAI_API_KEY environment variable not set")
        print("   Set it with: export OPENAI_API_KEY='your-key'")
        return None

    if not grok_api_key:
        print("❌ Error: GROK_API_KEY environment variable not set")
        print("   Set it with: export GROK_API_KEY='your-key'")
        return None

    # Check video file exists
    if not os.path.exists(video_path):
        print(f"❌ Error: Video file not found: {video_path}")
        return None

    # Get video file info
    file_size_mb = os.path.getsize(video_path) / (1024 * 1024)
    print(f"📹 Video: {video_path}")
    print(f"📦 Size: {file_size_mb:.1f} MB")
    print(f"⏱️  Segment duration: {segment_duration} seconds ({segment_duration/60:.1f} minutes)")
    print()

    # Initialize director
    base_dir = os.path.dirname(os.path.abspath(__file__))
    director = SimpleDirector(openai_api_key, grok_api_key, base_dir=base_dir)

    # Run analysis
    result = await director.analyze_video(video_path, segment_duration=segment_duration)

    return result


def main():
    # Parse command line arguments
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    video_path = sys.argv[1]
    
    # Optional segment duration
    segment_duration = 150  # Default: 2.5 minutes
    if len(sys.argv) >= 3:
        try:
            segment_duration = int(sys.argv[2])
        except ValueError:
            print(f"❌ Error: Invalid segment duration: {sys.argv[2]}")
            sys.exit(1)

    # Run the analysis
    print("🎬 PETE DYE STORY - VIDEO ANALYSIS")
    print("=" * 50)
    
    result = asyncio.run(run_analysis(video_path, segment_duration))
    
    if result:
        print("\n" + "=" * 50)
        print("✅ ANALYSIS COMPLETE!")
        print("=" * 50)
    else:
        print("\n❌ Analysis failed. Check the errors above.")
        sys.exit(1)


if __name__ == "__main__":
    main()

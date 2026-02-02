"""
Simple Director - Video Analysis Orchestrator
Main orchestrator system using Agent-as-Tool pattern for parallel video processing.
Uses OpenAI for all AI operations (audio + vision + synthesis).

Part of the Pete Dye Story video processing system.
"""

import asyncio
import subprocess
import os
import json
import time
import re
from datetime import timedelta
from dataclasses import dataclass
from typing import List
from openai import OpenAI

# Import sub-agent from same directory
from fast_multimodal_transcript import FastMultimodalVideoTranscriber


@dataclass
class VideoSegment:
    """Represents a video segment for processing"""
    segment_id: int
    start_time: float
    end_time: float
    duration: float
    file_path: str
    timestamp_range: str


class SimpleDirector:
    """
    SIMPLE Director - 4-Phase Video Analysis Pipeline:
    1. Extract and transcribe FULL audio first
    2. Create video segments for visual analysis
    3. Process segments with visual analysis + sync to full transcript
    4. Send everything to GPT-4o for synthesis
    
    Uses OpenAI for everything - only one API key needed.
    """

    def __init__(self, openai_api_key: str, base_dir: str = None):
        self.openai_api_key = openai_api_key
        self.openai_client = OpenAI(api_key=openai_api_key)
        
        # Set base directory (defaults to video-processing folder)
        if base_dir:
            self.base_dir = base_dir
        else:
            self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        self.base_segments_dir = os.path.join(self.base_dir, "segments")
        self.base_output_dir = os.path.join(self.base_dir, "output")

        # Create base directories
        for directory in [self.base_segments_dir, self.base_output_dir]:
            if not os.path.exists(directory):
                os.makedirs(directory)

        # Initialize sub-agent (now only needs OpenAI key)
        self.sub_agent = FastMultimodalVideoTranscriber(openai_api_key)

    def setup_video_folders(self, video_path: str) -> tuple:
        """Create organized folder structure for a specific video"""
        video_name = os.path.splitext(os.path.basename(video_path))[0]
        video_name = re.sub(r'[^\w\-_]', '_', video_name)  # Clean filename

        # Create video-specific directories
        video_output_dir = os.path.join(self.base_output_dir, video_name)
        video_segments_dir = os.path.join(self.base_segments_dir, video_name)

        # Create subdirectories for organized output
        subdirs = [
            os.path.join(video_output_dir, "analysis"),    # Analysis results
            os.path.join(video_output_dir, "audio"),       # Extracted audio files
            os.path.join(video_output_dir, "frames"),      # Video frames
            os.path.join(video_output_dir, "segments"),    # Segment metadata
            video_segments_dir                              # Temp segment videos
        ]

        for directory in subdirs:
            if not os.path.exists(directory):
                os.makedirs(directory)

        return video_output_dir, video_segments_dir

    def get_video_duration(self, video_path: str) -> float:
        """Get video duration using ffprobe"""
        try:
            cmd = ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', video_path]
            result = subprocess.run(cmd, capture_output=True, text=True)
            return float(result.stdout.strip())
        except Exception as e:
            print(f"Error getting video duration: {e}")
            return 0.0

    def create_segments(self, video_path: str, video_segments_dir: str, segment_duration: int = 150) -> List[VideoSegment]:
        """Create video segment metadata"""
        total_duration = self.get_video_duration(video_path)
        segments = []

        segment_id = 0
        start_time = 0.0

        while start_time < total_duration:
            end_time = min(start_time + segment_duration, total_duration)
            duration = end_time - start_time

            segment = VideoSegment(
                segment_id=segment_id,
                start_time=start_time,
                end_time=end_time,
                duration=duration,
                file_path=f"{video_segments_dir}/segment_{segment_id:03d}_{int(start_time)}s-{int(end_time)}s.mp4",
                timestamp_range=f"{str(timedelta(seconds=int(start_time)))} - {str(timedelta(seconds=int(end_time)))}"
            )

            segments.append(segment)
            segment_id += 1
            start_time = end_time

        return segments

    def extract_segment(self, video_path: str, segment: VideoSegment) -> bool:
        """Extract a video segment using ffmpeg"""
        cmd = [
            'ffmpeg', '-i', video_path,
            '-ss', str(segment.start_time),
            '-t', str(segment.duration),
            '-c', 'copy', '-avoid_negative_ts', 'make_zero',
            '-y', segment.file_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        return result.returncode == 0

    async def process_segment_async(self, segment: VideoSegment):
        """Process one segment with our proven sub-agent"""
        print(f"🔄 Processing segment {segment.segment_id}: {segment.timestamp_range}")

        # Use asyncio executor for true parallel processing
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self.sub_agent.process_video_fast,
            segment.file_path,
            4  # frame_interval
        )

        return {
            'segment_id': segment.segment_id,
            'timestamp_range': segment.timestamp_range,
            'multimodal_analysis': result.get('multimodal_analysis', ''),
            'audio_transcript': result.get('audio_transcript', ''),
            'processing_time': result.get('processing_time', 0)
        }

    async def process_segment_with_full_transcript_async(self, segment: VideoSegment, full_transcript: dict):
        """Process one segment with VISUAL analysis only, using full transcript for audio"""
        print(f"🔄 Processing segment {segment.segment_id}: {segment.timestamp_range} (visual analysis)")

        # Use asyncio executor for visual-only processing
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            self.sub_agent.process_video_visual_only,
            segment.file_path,
            4,  # frame_interval
            full_transcript  # Pass the complete transcript
        )

        return {
            'segment_id': segment.segment_id,
            'timestamp_range': segment.timestamp_range,
            'multimodal_analysis': result.get('multimodal_analysis', ''),
            'audio_transcript_excerpt': self.extract_transcript_for_segment(full_transcript, segment),
            'processing_time': result.get('processing_time', 0)
        }

    def extract_transcript_for_segment(self, full_transcript: dict, segment: VideoSegment) -> str:
        """Extract the relevant portion of full transcript for this segment"""
        start_time = segment.start_time
        end_time = segment.end_time

        # Get high-quality and timestamped transcripts
        high_quality = full_transcript.get('high_quality_transcript', '')
        timestamped = full_transcript.get('timestamped_transcript', [])

        # Extract relevant timestamped portions
        relevant_chunks = []
        for chunk in timestamped:
            chunk_start = chunk.get('start', 0)
            chunk_end = chunk.get('end', 0)

            # If chunk overlaps with segment timeframe
            if (chunk_start < end_time and chunk_end > start_time):
                relevant_chunks.append(chunk.get('text', ''))

        if relevant_chunks:
            return ' '.join(relevant_chunks)
        else:
            # Fallback: estimate from high-quality transcript
            total_duration = end_time
            chars_per_second = len(high_quality) / total_duration if total_duration > 0 else 0
            start_char = int(start_time * chars_per_second)
            end_char = int(end_time * chars_per_second)
            return high_quality[start_char:end_char]

    def openai_synthesis(self, segment_results: List[dict], full_transcript: dict = None) -> dict:
        """Send all segment results to GPT-4o for final synthesis"""
        print("🎯 GPT-4o SYNTHESIS - Combining all segments...")

        # Prepare combined content
        combined_content = "COMPLETE VIDEO ANALYSIS:\n\n"

        # Include full transcript at the top for context
        if full_transcript:
            combined_content += f"COMPLETE AUDIO TRANSCRIPT:\n{full_transcript.get('high_quality_transcript', '')[:3000]}...\n\n"

        combined_content += "SEGMENT-BY-SEGMENT ANALYSIS:\n\n"

        for result in segment_results:
            combined_content += f"=== SEGMENT {result['segment_id']} ({result['timestamp_range']}) ===\n\n"
            combined_content += f"AUDIO EXCERPT:\n{result.get('audio_transcript_excerpt', result.get('audio_transcript', ''))[:800]}...\n\n"
            combined_content += f"VISUAL ANALYSIS:\n{result['multimodal_analysis'][:2000]}...\n\n"

        # Ask GPT-4o to synthesize everything
        prompt = f"""
{combined_content}

Based on the COMPLETE analysis above, provide the REAL video content synthesis:

**1. SUMMARY** (2-3 sentences about what actually happens in this video):

**2. CHARACTERS** (list the actual people who appear or are mentioned):

**3. CHAPTER BREAKDOWN** (natural story progression with timestamps):

**4. HIGHLIGHTS & MEMORABLE MOMENTS** (actual memorable moments with context):

Be completely accurate to the content. Extract the real story, don't invent anything.
This is Pete Dye Golf Club construction footage - look for Pete Dye, construction workers, equipment, and the golf course building process.
"""

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=4000,
                temperature=0.1
            )

            synthesis_text = response.choices[0].message.content

            return {
                'video_analysis': {
                    'synthesis_text': synthesis_text,
                    'total_segments': len(segment_results),
                    'total_duration_minutes': sum(r.get('processing_time', 0) for r in segment_results) / 60
                },
                'raw_segments': segment_results
            }
        except Exception as e:
            print(f"❌ GPT-4o synthesis failed: {e}")
            return None

    async def analyze_video(self, video_path: str, segment_duration: int = 150) -> dict:
        """
        MAIN ENTRY POINT - 4-Phase Video Analysis Pipeline:
        1. Extract and transcribe FULL audio first
        2. Create video segments for visual analysis
        3. Process segments with visual analysis + sync to full transcript
        4. Send everything to GPT-4o for synthesis
        """
        print("🎬 SIMPLE DIRECTOR SYSTEM - Pete Dye Story")
        print("=" * 50)
        print("Using OpenAI for all AI operations")
        print("=" * 50)
        start_time = time.time()

        # Setup organized folders for this video
        print("📁 Setting up organized folders...")
        video_output_dir, video_segments_dir = self.setup_video_folders(video_path)
        print(f"Output directory: {video_output_dir}")

        # PHASE 1: Extract and transcribe FULL audio first
        print("🎵 Phase 1: Extracting and transcribing complete audio...")
        full_audio_path = f"{video_output_dir}/audio/full_audio.mp3"
        os.makedirs(os.path.dirname(full_audio_path), exist_ok=True)

        # Extract full audio from source video
        audio_path = self.sub_agent.extract_audio_from_video(video_path, full_audio_path)
        print(f"✅ Full audio extracted to {audio_path}")

        # Transcribe the complete audio
        full_transcript = self.sub_agent.transcribe_audio_openai(audio_path)

        # Check if transcription was successful
        if full_transcript and 'high_quality_transcript' in full_transcript:
            transcript_length = len(full_transcript['high_quality_transcript'])
            print(f"✅ Complete audio transcribed ({transcript_length} characters)")
        else:
            print(f"❌ Audio transcription failed: {full_transcript}")
            # Continue with empty transcript rather than failing completely
            full_transcript = {
                'high_quality_transcript': '',
                'timestamped_transcript': []
            }

        # PHASE 2: Prepare video segments (for visual analysis only)
        print("📝 Phase 2: Creating video segments...")
        segments = self.create_segments(video_path, video_segments_dir, segment_duration)
        print(f"Created {len(segments)} segments")

        # Extract video segments
        print("✂️ Extracting video segments...")
        for segment in segments:
            if not self.extract_segment(video_path, segment):
                print(f"❌ Failed to extract segment {segment.segment_id}")
                continue

        # PHASE 3: Process segments with visual analysis + full transcript sync
        print(f"🚀 Phase 3: Processing {len(segments)} segments with visual analysis...")

        tasks = [self.process_segment_with_full_transcript_async(segment, full_transcript) for segment in segments]
        segment_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions
        valid_results = [r for r in segment_results if not isinstance(r, Exception)]
        print(f"✅ Processed {len(valid_results)}/{len(segments)} segments")

        # PHASE 4: GPT-4o synthesis
        print("🎯 Phase 4: GPT-4o synthesis...")
        final_synthesis = self.openai_synthesis(valid_results, full_transcript)

        # Save results
        processing_time = time.time() - start_time
        print(f"💾 Saving results...")

        # Save JSON
        final_synthesis['processing_metadata'] = {
            'total_processing_time_minutes': processing_time / 60,
            'speed_improvement': f"{(len(segments) * segment_duration) / processing_time:.1f}x faster than realtime",
            'video_path': video_path,
            'processed_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'ai_provider': 'OpenAI (GPT-4o)'
        }

        # Save full transcript separately
        transcript_path = f"{video_output_dir}/analysis/full_transcript.txt"
        with open(transcript_path, 'w') as f:
            f.write(full_transcript.get('high_quality_transcript', ''))

        analysis_json_path = f"{video_output_dir}/analysis/simple_director_analysis.json"
        analysis_md_path = f"{video_output_dir}/analysis/simple_director_analysis.md"

        with open(analysis_json_path, 'w') as f:
            json.dump(final_synthesis, f, indent=2, default=str)

        # Save Markdown
        with open(analysis_md_path, 'w') as f:
            f.write("# 🎬 Pete Dye Story - Video Analysis\n\n")
            f.write(final_synthesis['video_analysis']['synthesis_text'])
            f.write(f"\n\n---\n\n**Processing Time**: {processing_time/60:.1f} minutes\n")
            f.write(f"**Speed**: {(len(segments) * segment_duration) / processing_time:.1f}x faster than realtime\n")
            f.write(f"**Segments Processed**: {len(valid_results)}\n")
            f.write(f"**AI Provider**: OpenAI (GPT-4o)\n")

        # Cleanup segments
        print("🧹 Cleaning up...")
        for segment in segments:
            if os.path.exists(segment.file_path):
                os.remove(segment.file_path)

        total_time = time.time() - start_time
        print(f"🎉 COMPLETE! Processed in {total_time/60:.1f} minutes")
        print(f"📁 Results: {video_output_dir}/analysis/")
        print(f"   JSON: {analysis_json_path}")
        print(f"   MD:   {analysis_md_path}")
        print(f"   Transcript: {transcript_path}")

        return final_synthesis

    def cleanup_segments(self):
        """Clean up segment files"""
        if os.path.exists(self.base_segments_dir):
            for file in os.listdir(self.base_segments_dir):
                file_path = os.path.join(self.base_segments_dir, file)
                if os.path.isfile(file_path):
                    os.remove(file_path)


async def main():
    """Test the Simple Director"""
    openai_api_key = os.environ.get('OPENAI_API_KEY')

    if not openai_api_key:
        print("Error: Please set OPENAI_API_KEY environment variable")
        return

    director = SimpleDirector(openai_api_key)

    # Test with a video file
    video_path = "../test/test_video.mp4"

    if os.path.exists(video_path):
        print("🎬 RUNNING SIMPLE DIRECTOR")
        print("-" * 70)
        result = await director.analyze_video(video_path)
        print(f"\n🎯 Analysis complete!")
    else:
        print(f"Test video not found: {video_path}")


if __name__ == "__main__":
    asyncio.run(main())

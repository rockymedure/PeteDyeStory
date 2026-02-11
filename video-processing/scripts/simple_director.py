"""
Simple Director - Video Analysis Orchestrator
Main orchestrator system using Agent-as-Tool pattern for parallel video processing.
Uses OpenAI for all AI operations (audio + vision + synthesis).

Part of the Pete Dye Story video processing system.

Stream A overhaul:
- GPT-5.1 for synthesis with structured JSON output
- Character knowledge base injection from characters.json
- Speaker diarization integration
- Structured output schema with strict validation
- Human-readable markdown report generated from structured data
"""

import asyncio
import subprocess
import os
import json
import time
import re
from datetime import timedelta
from dataclasses import dataclass
from typing import List, Optional
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
    1. Extract and transcribe FULL audio (with diarization) first
    2. Create video segments for visual analysis
    3. Process segments with visual analysis + sync to full transcript
    4. Send everything to GPT-5.1 for structured synthesis

    Uses OpenAI for everything - only one API key needed.
    """

    # Structured output JSON schema for GPT-5.1 response_format
    # All fields required, all objects have additionalProperties: false
    ANALYSIS_SCHEMA = {
        "type": "object",
        "properties": {
            "title": {
                "type": "string"
            },
            "content_type": {
                "type": "string"
            },
            "summary": {
                "type": "string"
            },
            "characters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string"
                        },
                        "role": {
                            "type": "string"
                        },
                        "description": {
                            "type": "string"
                        },
                        "is_speaking": {
                            "type": "boolean"
                        }
                    },
                    "required": ["name", "role", "description", "is_speaking"],
                    "additionalProperties": False
                }
            },
            "chapters": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string"
                        },
                        "start_time": {
                            "type": "string"
                        },
                        "end_time": {
                            "type": "string"
                        },
                        "summary": {
                            "type": "string"
                        },
                        "characters_present": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            }
                        }
                    },
                    "required": ["title", "start_time", "end_time", "summary", "characters_present"],
                    "additionalProperties": False
                }
            },
            "highlights": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {
                            "type": "string"
                        },
                        "timestamp": {
                            "type": "string"
                        },
                        "description": {
                            "type": "string"
                        },
                        "emotional_tone": {
                            "type": "string"
                        },
                        "characters_involved": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            }
                        }
                    },
                    "required": ["title", "timestamp", "description", "emotional_tone", "characters_involved"],
                    "additionalProperties": False
                }
            },
            "quotes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "text": {
                            "type": "string"
                        },
                        "speaker": {
                            "type": "string"
                        },
                        "timestamp": {
                            "type": "string"
                        },
                        "context": {
                            "type": "string"
                        }
                    },
                    "required": ["text", "speaker", "timestamp", "context"],
                    "additionalProperties": False
                }
            },
            "themes": {
                "type": "array",
                "items": {
                    "type": "string"
                }
            }
        },
        "required": ["title", "content_type", "summary", "characters", "chapters", "highlights", "quotes", "themes"],
        "additionalProperties": False
    }

    def __init__(self, openai_api_key: str, base_dir: str = None, model: str = "gpt-5.1", skip_diarization: bool = False):
        self.openai_api_key = openai_api_key
        self.openai_client = OpenAI(api_key=openai_api_key)
        self.model = model
        self.skip_diarization = skip_diarization

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

        # Load character knowledge base
        self.characters = self._load_characters()

        # Initialize sub-agent (now only needs OpenAI key)
        self.sub_agent = FastMultimodalVideoTranscriber(openai_api_key)

    def _load_characters(self) -> dict:
        """Load the character knowledge base from characters.json"""
        characters_path = os.path.join(self.base_dir, "characters.json")
        if os.path.exists(characters_path):
            with open(characters_path, 'r') as f:
                data = json.load(f)
            print(f"Loaded {len(data.get('characters', []))} characters from knowledge base")
            return data
        else:
            print(f"Warning: characters.json not found at {characters_path}")
            return {"characters": [], "context": ""}

    def _build_character_context(self) -> str:
        """Format the characters.json data into a string for prompt injection"""
        if not self.characters or not self.characters.get("characters"):
            return ""

        lines = []
        lines.append("=== CHARACTER KNOWLEDGE BASE ===")
        lines.append(f"Project Context: {self.characters.get('context', '')}")
        lines.append("")
        lines.append("Known people who may appear in the footage:")
        lines.append("")

        for char in self.characters["characters"]:
            name = char.get("name", "Unknown")
            aliases = ", ".join(char.get("aliases", []))
            role = char.get("role", "")
            description = char.get("description", "")
            physical = char.get("physical_description", "")
            relationships = "; ".join(char.get("relationships", []))
            quotes = char.get("key_quotes", [])

            lines.append(f"**{name}**")
            if aliases:
                lines.append(f"  Aliases: {aliases}")
            lines.append(f"  Role: {role}")
            lines.append(f"  Description: {description}")
            if physical:
                lines.append(f"  Visual ID: {physical}")
            if relationships:
                lines.append(f"  Relationships: {relationships}")
            if quotes:
                for q in quotes:
                    lines.append(f'  Known quote: "{q}"')
            lines.append("")

        return "\n".join(lines)

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
        print(f"Processing segment {segment.segment_id}: {segment.timestamp_range}")

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
        print(f"Processing segment {segment.segment_id}: {segment.timestamp_range} (visual analysis)")

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
        # Note: timestamped items may be TranscriptionWord objects (with attributes)
        # or dicts, depending on the OpenAI SDK version
        relevant_chunks = []
        for chunk in timestamped:
            chunk_start = getattr(chunk, 'start', chunk.get('start', 0) if isinstance(chunk, dict) else 0)
            chunk_end = getattr(chunk, 'end', chunk.get('end', 0) if isinstance(chunk, dict) else 0)

            # If chunk overlaps with segment timeframe
            if (chunk_start < end_time and chunk_end > start_time):
                word_text = getattr(chunk, 'word', None) or getattr(chunk, 'text', None)
                if word_text is None and isinstance(chunk, dict):
                    word_text = chunk.get('word', chunk.get('text', ''))
                relevant_chunks.append(word_text or '')

        if relevant_chunks:
            return ' '.join(relevant_chunks)
        else:
            # Fallback: estimate from high-quality transcript
            total_duration = end_time
            chars_per_second = len(high_quality) / total_duration if total_duration > 0 else 0
            start_char = int(start_time * chars_per_second)
            end_char = int(end_time * chars_per_second)
            return high_quality[start_char:end_char]

    def _format_diarization_for_prompt(self, diarization: Optional[dict]) -> str:
        """Format diarization results into a readable string for the synthesis prompt"""
        if not diarization or not diarization.get("segments"):
            return "No speaker diarization data available."

        lines = []
        lines.append("=== SPEAKER DIARIZATION ===")
        lines.append("Speaker labels (A, B, C, etc.) represent distinct voices detected in the audio.")
        lines.append("Use the character knowledge base to match speaker labels to real people.")
        lines.append("")

        for seg in diarization["segments"]:
            speaker = seg.get("speaker", "?")
            text = seg.get("text", "")
            start = seg.get("start", 0)
            end = seg.get("end", 0)
            start_ts = str(timedelta(seconds=int(start)))
            end_ts = str(timedelta(seconds=int(end)))
            lines.append(f"[{start_ts} - {end_ts}] Speaker {speaker}: {text}")

        return "\n".join(lines)

    def openai_synthesis(self, segment_results: List[dict], full_transcript: dict = None, diarization: Optional[dict] = None) -> dict:
        """Send all segment results to GPT-5.1 for structured synthesis with JSON schema output"""
        print("GPT-5.1 SYNTHESIS - Combining all segments with structured output...")

        # Build the character knowledge context
        character_context = self._build_character_context()

        # Format the diarization data
        diarization_text = self._format_diarization_for_prompt(diarization)

        # Build the full transcript text (no truncation - GPT-5.1 has 400K context)
        full_transcript_text = ""
        if full_transcript:
            full_transcript_text = full_transcript.get('high_quality_transcript', '')

        # Build segment-by-segment visual analysis
        segment_analysis_text = ""
        for result in segment_results:
            segment_analysis_text += f"\n=== SEGMENT {result['segment_id']} ({result['timestamp_range']}) ===\n"
            audio_excerpt = result.get('audio_transcript_excerpt', result.get('audio_transcript', ''))
            segment_analysis_text += f"\nAUDIO EXCERPT:\n{audio_excerpt}\n"
            segment_analysis_text += f"\nVISUAL ANALYSIS:\n{result['multimodal_analysis']}\n"

        # System message: unbiased documentary analyst with character knowledge
        system_message = (
            "You are a documentary film analyst reviewing archival footage from the Pete Dye Golf Club story "
            "(1978-2004). This archive contains diverse footage including: golf course construction, family "
            "gatherings, holidays, grand opening ceremonies, interviews, award ceremonies, professional golf "
            "tournaments, celebrity visits, Christmas parties, and social events. Analyze the content accurately "
            "based on what you actually see and hear. Do not assume everything is construction footage.\n\n"
            "You must return a structured JSON analysis following the provided schema exactly.\n\n"
            f"{character_context}"
        )

        # User message: all evidence for synthesis
        user_message = (
            f"Analyze the following video evidence and produce a complete structured analysis.\n\n"
            f"=== COMPLETE AUDIO TRANSCRIPT ===\n{full_transcript_text}\n\n"
            f"{diarization_text}\n\n"
            f"=== SEGMENT-BY-SEGMENT VISUAL ANALYSIS ===\n{segment_analysis_text}\n\n"
            f"Based on ALL of the above evidence (transcript, speaker diarization, and visual analysis), "
            f"produce a comprehensive video analysis. Identify the content type accurately (e.g., construction "
            f"footage, interview, ceremony, family gathering, tournament, etc.). Match speaker labels from "
            f"diarization to real people using the character knowledge base. Extract real quotes with accurate "
            f"speaker attribution. Create natural chapter breaks that follow the video's actual narrative flow."
        )

        try:
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ],
                max_completion_tokens=8000,
                temperature=0.1,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "video_analysis",
                        "strict": True,
                        "schema": self.ANALYSIS_SCHEMA
                    }
                }
            )

            # Parse the structured JSON response
            raw_content = response.choices[0].message.content
            structured_analysis = json.loads(raw_content)

            return {
                'video_analysis': structured_analysis,
                'raw_segments': segment_results,
                'synthesis_metadata': {
                    'model': self.model,
                    'total_segments': len(segment_results),
                    'transcript_length': len(full_transcript_text),
                    'diarization_segments': len(diarization.get('segments', [])) if diarization else 0,
                    'characters_in_knowledge_base': len(self.characters.get('characters', []))
                }
            }
        except json.JSONDecodeError as e:
            print(f"JSON parsing error from GPT-5.1 response: {e}")
            print(f"Raw response: {raw_content[:500]}")
            return {
                'video_analysis': {
                    'title': 'Analysis Error - JSON Parse Failure',
                    'content_type': 'error',
                    'summary': f'GPT-5.1 returned invalid JSON: {str(e)}',
                    'characters': [],
                    'chapters': [],
                    'highlights': [],
                    'quotes': [],
                    'themes': []
                },
                'raw_segments': segment_results,
                'synthesis_metadata': {
                    'model': self.model,
                    'error': str(e)
                }
            }
        except Exception as e:
            print(f"GPT-5.1 synthesis failed: {e}")
            return {
                'video_analysis': {
                    'title': 'Analysis Error',
                    'content_type': 'error',
                    'summary': f'GPT-5.1 synthesis failed: {str(e)}',
                    'characters': [],
                    'chapters': [],
                    'highlights': [],
                    'quotes': [],
                    'themes': []
                },
                'raw_segments': segment_results,
                'synthesis_metadata': {
                    'model': self.model,
                    'error': str(e)
                }
            }

    def _generate_markdown_report(self, structured_analysis: dict, processing_time: float, num_segments: int, video_path: str) -> str:
        """Generate a clean, producer-friendly markdown document from the structured JSON analysis"""
        lines = []

        title = structured_analysis.get('title', 'Untitled Video')
        content_type = structured_analysis.get('content_type', 'Unknown')
        summary = structured_analysis.get('summary', '')
        characters = structured_analysis.get('characters', [])
        chapters = structured_analysis.get('chapters', [])
        highlights = structured_analysis.get('highlights', [])
        quotes = structured_analysis.get('quotes', [])
        themes = structured_analysis.get('themes', [])

        # Title and metadata
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**Content Type:** {content_type}")
        lines.append(f"**Source:** `{os.path.basename(video_path)}`")
        lines.append(f"**Analyzed:** {time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**AI Provider:** OpenAI (GPT-5.1)")
        lines.append("")

        # Summary
        lines.append("## Summary")
        lines.append("")
        lines.append(summary)
        lines.append("")

        # Characters table
        if characters:
            lines.append("## Characters")
            lines.append("")
            lines.append("| Name | Role | Speaking | Description |")
            lines.append("|------|------|----------|-------------|")
            for char in characters:
                speaking = "Yes" if char.get('is_speaking', False) else "No"
                name = char.get('name', 'Unknown')
                role = char.get('role', '')
                desc = char.get('description', '')
                # Escape pipe characters in table cells
                desc = desc.replace('|', '\\|')
                role = role.replace('|', '\\|')
                lines.append(f"| {name} | {role} | {speaking} | {desc} |")
            lines.append("")

        # Chapters with timestamps
        if chapters:
            lines.append("## Chapters")
            lines.append("")
            for i, chapter in enumerate(chapters, 1):
                ch_title = chapter.get('title', f'Chapter {i}')
                start = chapter.get('start_time', '')
                end = chapter.get('end_time', '')
                ch_summary = chapter.get('summary', '')
                ch_chars = chapter.get('characters_present', [])

                lines.append(f"### {i}. {ch_title}")
                lines.append(f"**{start} - {end}**")
                lines.append("")
                lines.append(ch_summary)
                if ch_chars:
                    lines.append("")
                    lines.append(f"*Characters: {', '.join(ch_chars)}*")
                lines.append("")

        # Highlights
        if highlights:
            lines.append("## Highlights")
            lines.append("")
            for hl in highlights:
                hl_title = hl.get('title', '')
                hl_ts = hl.get('timestamp', '')
                hl_desc = hl.get('description', '')
                hl_tone = hl.get('emotional_tone', '')
                hl_chars = hl.get('characters_involved', [])

                lines.append(f"- **{hl_title}** [{hl_ts}]")
                lines.append(f"  {hl_desc}")
                if hl_tone:
                    lines.append(f"  *Tone: {hl_tone}*")
                if hl_chars:
                    lines.append(f"  *Involving: {', '.join(hl_chars)}*")
                lines.append("")

        # Notable Quotes
        if quotes:
            lines.append("## Notable Quotes")
            lines.append("")
            for q in quotes:
                q_text = q.get('text', '')
                q_speaker = q.get('speaker', 'Unknown')
                q_ts = q.get('timestamp', '')
                q_context = q.get('context', '')

                lines.append(f'> "{q_text}"')
                lines.append(f"> — **{q_speaker}** [{q_ts}]")
                if q_context:
                    lines.append(f"> *{q_context}*")
                lines.append("")

        # Themes
        if themes:
            lines.append("## Themes")
            lines.append("")
            for theme in themes:
                lines.append(f"- {theme}")
            lines.append("")

        # Processing metadata footer
        lines.append("---")
        lines.append("")
        lines.append("## Processing Metadata")
        lines.append("")
        lines.append(f"- **Processing Time:** {processing_time / 60:.1f} minutes")
        lines.append(f"- **Segments Processed:** {num_segments}")
        lines.append(f"- **AI Provider:** OpenAI (GPT-5.1)")
        lines.append(f"- **Schema:** Structured JSON with strict validation")
        lines.append("")

        return "\n".join(lines)

    async def analyze_video(self, video_path: str, segment_duration: int = 150) -> dict:
        """
        MAIN ENTRY POINT - 4-Phase Video Analysis Pipeline:
        1. Extract and transcribe FULL audio (with diarization) first
        2. Create video segments for visual analysis
        3. Process segments with visual analysis + sync to full transcript
        4. Send everything to GPT-5.1 for structured synthesis
        """
        print("SIMPLE DIRECTOR SYSTEM - Pete Dye Story")
        print("=" * 50)
        print("Using OpenAI for all AI operations (GPT-5.1 synthesis)")
        print("=" * 50)
        start_time = time.time()

        # Setup organized folders for this video
        print("Setting up organized folders...")
        video_output_dir, video_segments_dir = self.setup_video_folders(video_path)
        print(f"Output directory: {video_output_dir}")

        # PHASE 1: Extract and transcribe FULL audio (with diarization)
        print("Phase 1: Extracting and transcribing complete audio (with diarization)...")
        full_audio_path = f"{video_output_dir}/audio/full_audio.mp3"
        os.makedirs(os.path.dirname(full_audio_path), exist_ok=True)

        # Extract full audio from source video
        audio_path = self.sub_agent.extract_audio_from_video(video_path, full_audio_path)
        print(f"Full audio extracted to {audio_path}")

        # Transcribe the complete audio (standard transcription)
        full_transcript = self.sub_agent.transcribe_audio_openai(audio_path)

        # Check if transcription was successful
        if full_transcript and 'high_quality_transcript' in full_transcript:
            transcript_length = len(full_transcript['high_quality_transcript'])
            print(f"Complete audio transcribed ({transcript_length} characters)")
        else:
            print(f"Audio transcription failed: {full_transcript}")
            # Continue with empty transcript rather than failing completely
            full_transcript = {
                'high_quality_transcript': '',
                'timestamped_transcript': []
            }

        # Run diarization (speaker identification)
        diarization = None
        if self.skip_diarization:
            print("Diarization: SKIPPED (--skip-diarization flag set)")
        elif hasattr(self.sub_agent, 'transcribe_audio_diarized'):
            print("Running speaker diarization...")
            try:
                diarization = self.sub_agent.transcribe_audio_diarized(audio_path)
                if diarization and diarization.get('segments'):
                    num_speakers = len(set(seg.get('speaker', '') for seg in diarization['segments']))
                    print(f"Diarization complete: {num_speakers} speakers detected, {len(diarization['segments'])} segments")
                else:
                    print("Diarization returned no segments")
                    diarization = None
            except Exception as e:
                print(f"Diarization failed (continuing without it): {e}")
                diarization = None
        else:
            print("Sub-agent does not support diarization (transcribe_audio_diarized not available)")

        # PHASE 2: Prepare video segments (for visual analysis only)
        print("Phase 2: Creating video segments...")
        segments = self.create_segments(video_path, video_segments_dir, segment_duration)
        print(f"Created {len(segments)} segments")

        # Extract video segments
        print("Extracting video segments...")
        for segment in segments:
            if not self.extract_segment(video_path, segment):
                print(f"Failed to extract segment {segment.segment_id}")
                continue

        # PHASE 3: Process segments with visual analysis + full transcript sync
        print(f"Phase 3: Processing {len(segments)} segments with visual analysis...")

        tasks = [self.process_segment_with_full_transcript_async(segment, full_transcript) for segment in segments]
        segment_results = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions
        valid_results = []
        for r in segment_results:
            if isinstance(r, Exception):
                print(f"Segment processing exception: {r}")
            else:
                valid_results.append(r)
        print(f"Processed {len(valid_results)}/{len(segments)} segments")

        # PHASE 4: GPT-5.1 structured synthesis
        print("Phase 4: GPT-5.1 structured synthesis...")
        final_synthesis = self.openai_synthesis(valid_results, full_transcript, diarization)

        # Save results
        processing_time = time.time() - start_time
        print("Saving results...")

        # Add processing metadata
        final_synthesis['processing_metadata'] = {
            'total_processing_time_minutes': processing_time / 60,
            'speed_improvement': f"{(len(segments) * segment_duration) / processing_time:.1f}x faster than realtime",
            'video_path': video_path,
            'processed_at': time.strftime('%Y-%m-%d %H:%M:%S'),
            'ai_provider': f'OpenAI ({self.model})',
            'diarization_available': diarization is not None,
            'characters_loaded': len(self.characters.get('characters', []))
        }

        # Save full transcript separately
        transcript_path = f"{video_output_dir}/analysis/full_transcript.txt"
        with open(transcript_path, 'w') as f:
            f.write(full_transcript.get('high_quality_transcript', ''))

        # Save diarization if available
        if diarization:
            diarization_path = f"{video_output_dir}/analysis/diarization.json"
            with open(diarization_path, 'w') as f:
                json.dump(diarization, f, indent=2, default=str)

        analysis_json_path = f"{video_output_dir}/analysis/simple_director_analysis.json"
        analysis_md_path = f"{video_output_dir}/analysis/simple_director_analysis.md"

        # Save structured JSON
        with open(analysis_json_path, 'w') as f:
            json.dump(final_synthesis, f, indent=2, default=str)

        # Generate human-readable markdown FROM the structured JSON
        structured_analysis = final_synthesis.get('video_analysis', {})
        markdown_report = self._generate_markdown_report(
            structured_analysis,
            processing_time,
            len(valid_results),
            video_path
        )

        with open(analysis_md_path, 'w') as f:
            f.write(markdown_report)

        # Cleanup segments
        print("Cleaning up temporary segment files...")
        for segment in segments:
            if os.path.exists(segment.file_path):
                os.remove(segment.file_path)

        total_time = time.time() - start_time
        print(f"COMPLETE! Processed in {total_time / 60:.1f} minutes")
        print(f"Results: {video_output_dir}/analysis/")
        print(f"   JSON: {analysis_json_path}")
        print(f"   MD:   {analysis_md_path}")
        print(f"   Transcript: {transcript_path}")
        if diarization:
            print(f"   Diarization: {video_output_dir}/analysis/diarization.json")

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
        print("RUNNING SIMPLE DIRECTOR")
        print("-" * 70)
        result = await director.analyze_video(video_path)
        print(f"\nAnalysis complete!")
    else:
        print(f"Test video not found: {video_path}")


if __name__ == "__main__":
    asyncio.run(main())

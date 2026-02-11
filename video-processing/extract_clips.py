#!/usr/bin/env python3
"""
Video Clip Extraction Module

Extracts highlight clips from processed videos based on:
1. Structured chapter data from analysis JSON
2. Structured highlight moments from analysis JSON
3. Segment-based extraction as fallback
4. Evenly-spaced filler clips for coverage

Priority system (highest first):
    5 - Chapters featuring Pete Dye
    4 - Highlights with emotional tone (emotional/proud/heartfelt)
    3 - Chapters with any named characters
    2 - Other chapters
    1 - Segment-based clips
    0 - Evenly-spaced filler clips

Backward compatible: falls back to regex-based extraction when
the new structured fields are absent (legacy synthesis_text format).

Extracts up to 10 clips per video.
"""

import os
import json
import re
import subprocess
from typing import List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class ClipInfo:
    """Information about a clip to extract"""
    start_time: str  # Format: HH:MM:SS
    duration: str    # Format: HH:MM:SS or seconds
    description: str
    priority: int = 0  # Higher = more important


def parse_timestamp(timestamp: str) -> int:
    """
    Convert timestamp string to seconds.
    Handles formats: HH:MM:SS, MM:SS, H:MM:SS, 0:00:00
    """
    parts = timestamp.strip().split(':')

    if len(parts) == 3:
        hours, minutes, seconds = parts
        return int(hours) * 3600 + int(minutes) * 60 + int(float(seconds))
    elif len(parts) == 2:
        minutes, seconds = parts
        return int(minutes) * 60 + int(float(seconds))
    else:
        return int(float(parts[0]))


def seconds_to_timestamp(seconds: int) -> str:
    """Convert seconds to HH:MM:SS format"""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


# ---------------------------------------------------------------------------
# Structured extraction (new JSON schema)
# ---------------------------------------------------------------------------

def extract_clips_from_chapters(analysis_data: dict) -> List[ClipInfo]:
    """
    Extract clip info from the structured chapters array.

    New schema path: analysis_data["video_analysis"]["chapters"]
    Each chapter: {title, start_time, end_time, summary, characters_present}

    Falls back to legacy regex parsing when structured data is absent.
    """
    video_analysis = analysis_data.get('video_analysis', {})
    chapters = video_analysis.get('chapters')

    # --- New structured path ---
    if chapters and isinstance(chapters, list):
        clips = []
        for chapter in chapters:
            title = chapter.get('title', 'Untitled Chapter')
            start_str = chapter.get('start_time', '')
            end_str = chapter.get('end_time', '')

            if not start_str or not end_str:
                continue

            start_secs = parse_timestamp(start_str)
            end_secs = parse_timestamp(end_str)
            duration_secs = end_secs - start_secs

            if duration_secs <= 0:
                continue

            # Cap clip duration at 3 minutes
            if duration_secs > 180:
                duration_secs = 180

            # Priority based on characters present
            characters_present = [c.lower() for c in chapter.get('characters_present', [])]
            if any('pete dye' in c for c in characters_present):
                priority = 5
            elif len(characters_present) > 0:
                priority = 3
            else:
                priority = 2

            clips.append(ClipInfo(
                start_time=seconds_to_timestamp(start_secs),
                duration=str(duration_secs),
                description=title[:80],
                priority=priority
            ))

        return clips

    # --- Legacy fallback: regex on synthesis_text ---
    return _extract_chapters_legacy(video_analysis)


def _extract_chapters_legacy(video_analysis: dict) -> List[ClipInfo]:
    """Legacy regex-based chapter extraction from synthesis_text."""
    clips = []
    synthesis = video_analysis.get('synthesis_text', '')

    # Pattern: timestamps like 0:00:00 - 0:02:30 or [0:05:00]
    chapter_pattern = r'(\d{1,2}:\d{2}:\d{2})\s*[-–to]+\s*(\d{1,2}:\d{2}:\d{2})[:\s]*([^\n\r]+)'
    matches = re.findall(chapter_pattern, synthesis)

    for start, end, description in matches:
        desc = description.strip()
        desc = re.sub(r'^\*+|\*+$', '', desc).strip()
        desc = desc[:80]

        if desc:
            start_secs = parse_timestamp(start)
            end_secs = parse_timestamp(end)
            duration_secs = end_secs - start_secs

            if duration_secs > 180:
                duration_secs = 180

            clips.append(ClipInfo(
                start_time=seconds_to_timestamp(start_secs),
                duration=str(duration_secs),
                description=desc,
                priority=1
            ))

    return clips


def extract_clips_from_highlights(analysis_data: dict) -> List[ClipInfo]:
    """
    Extract clip info from the structured highlights array.

    New schema path: analysis_data["video_analysis"]["highlights"]
    Each highlight: {title, timestamp, description, emotional_tone, characters_involved}

    Falls back to legacy regex parsing when structured data is absent.
    """
    video_analysis = analysis_data.get('video_analysis', {})
    highlights = video_analysis.get('highlights')

    # --- New structured path ---
    if highlights and isinstance(highlights, list):
        clips = []
        emotional_keywords = {'emotional', 'proud', 'heartfelt'}

        for highlight in highlights:
            title = highlight.get('title', highlight.get('description', 'Highlight'))
            timestamp = highlight.get('timestamp', '')

            if not timestamp:
                continue

            # Default 90-second duration for highlights
            duration_secs = 90

            # Priority based on emotional tone
            tone = (highlight.get('emotional_tone', '') or '').lower()
            if any(kw in tone for kw in emotional_keywords):
                priority = 4
            else:
                priority = 2

            clips.append(ClipInfo(
                start_time=timestamp,
                duration=str(duration_secs),
                description=title[:80],
                priority=priority
            ))

        return clips

    # --- Legacy fallback: regex on synthesis_text ---
    return _extract_highlights_legacy(video_analysis)


def _extract_highlights_legacy(video_analysis: dict) -> List[ClipInfo]:
    """Legacy regex-based highlight extraction from synthesis_text."""
    clips = []
    synthesis = video_analysis.get('synthesis_text', '')

    # Pattern: numbered items with timestamps
    highlight_pattern = r'(\d+)\.\s*\[?(\d{1,2}:\d{2}:\d{2})\]?\s*[-–:]?\s*([^\n\r]+)'
    matches = re.findall(highlight_pattern, synthesis)

    for num, timestamp, description in matches:
        desc = description.strip()
        desc = re.sub(r'^\*+|\*+$', '', desc).strip()
        desc = desc[:80]

        if desc:
            clips.append(ClipInfo(
                start_time=timestamp,
                duration="90",
                description=desc,
                priority=2
            ))

    return clips


def extract_clips_from_segments(analysis_data: dict) -> List[ClipInfo]:
    """
    Extract clip info from raw_segments array (fallback / legacy data).

    Reads from analysis_data["raw_segments"]. Each segment has:
      - timestamp_range: "H:MM:SS - H:MM:SS"
      - multimodal_analysis: free-text analysis of visual/audio content
    """
    clips = []

    segments = analysis_data.get('raw_segments', [])

    for segment in segments:
        timestamp_range = segment.get('timestamp_range', '')
        analysis = segment.get('multimodal_analysis', '')

        if not timestamp_range or not analysis:
            continue

        # Parse timestamp range
        match = re.match(r'(\d{1,2}:\d{2}:\d{2})\s*[-–]+\s*(\d{1,2}:\d{2}:\d{2})', timestamp_range)
        if not match:
            continue

        start, end = match.groups()
        start_secs = parse_timestamp(start)

        # Score content by keyword matching
        priority = 0
        description = ""
        analysis_lower = analysis.lower()

        # High priority: Pete Dye mentions
        if re.search(r'pete\s*dye|architect', analysis_lower):
            priority += 3
            description = "Pete Dye content"

        # High priority: Construction activity
        if re.search(r'construction|building|shaping|bulldozer|excavat', analysis_lower):
            priority += 2
            description = description or "Construction activity"

        # Medium priority: Interviews or speaking
        if re.search(r'interview|speaking|talking|says|said', analysis_lower):
            priority += 1
            description = description or "Interview/dialogue"

        # Medium priority: Opening/ceremony
        if re.search(r'opening|ceremony|celebration|grand', analysis_lower):
            priority += 2
            description = description or "Opening/ceremony"

        # Medium priority: Golf course views
        if re.search(r'hole|fairway|green|bunker|tee', analysis_lower):
            priority += 1
            description = description or "Golf course footage"

        # Segment-based clips get priority 1 as baseline (capped)
        if priority > 0 and description:
            clips.append(ClipInfo(
                start_time=seconds_to_timestamp(start_secs),
                duration="120",  # 2 minute default
                description=description,
                priority=min(priority, 1)  # segment-based capped at 1
            ))

    return clips


# ---------------------------------------------------------------------------
# Filler / utility functions
# ---------------------------------------------------------------------------

def generate_evenly_spaced_clips(video_duration_secs: int, num_clips: int = 5) -> List[ClipInfo]:
    """Generate evenly spaced clips across the video"""
    clips = []

    if video_duration_secs < 120:
        return clips

    # Calculate spacing
    clip_duration = 90  # 1.5 minutes each
    spacing = (video_duration_secs - clip_duration) / (num_clips + 1)

    for i in range(num_clips):
        start_secs = int(spacing * (i + 1))
        clips.append(ClipInfo(
            start_time=seconds_to_timestamp(start_secs),
            duration=str(clip_duration),
            description=f"Segment {i+1}",
            priority=0
        ))

    return clips


def get_video_duration(video_path: str) -> int:
    """Get video duration in seconds using ffprobe"""
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
             '-of', 'default=noprint_wrappers=1:nokey=1', video_path],
            capture_output=True,
            text=True
        )
        return int(float(result.stdout.strip()))
    except Exception:
        return 0


def sanitize_filename(name: str) -> str:
    """Convert description to valid filename slug"""
    # Remove or replace invalid characters
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', '-', name)
    name = re.sub(r'-+', '-', name)
    name = name.strip('-').lower()
    return name[:50]  # Limit length


def extract_clip(video_path: str, output_path: str, start_time: str, duration: str) -> bool:
    """
    Extract a clip from video using ffmpeg.

    Returns True if successful, False otherwise.
    """
    cmd = [
        'ffmpeg', '-y',
        '-ss', start_time,
        '-i', video_path,
        '-t', duration,
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-preset', 'fast',
        output_path
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout per clip
        )
        return result.returncode == 0
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def extract_clips_from_analysis(video_path: str, output_dir: str, max_clips: int = 10) -> List[str]:
    """
    Extract clips from a processed video based on its analysis.

    Args:
        video_path: Path to the original video file
        output_dir: Path to the video's output directory
        max_clips: Maximum number of clips to extract (default: 10)

    Returns:
        List of paths to extracted clips
    """
    clips_dir = os.path.join(output_dir, 'clips')
    os.makedirs(clips_dir, exist_ok=True)

    analysis_path = os.path.join(output_dir, 'analysis', 'simple_director_analysis.json')

    # Load analysis data
    if not os.path.exists(analysis_path):
        # No analysis — generate evenly spaced clips
        duration = get_video_duration(video_path)
        if duration > 0:
            clip_infos = generate_evenly_spaced_clips(duration, min(5, max_clips))
        else:
            return []
    else:
        with open(analysis_path, 'r') as f:
            analysis_data = json.load(f)

        # Collect clips from multiple sources (priority handled per-function)
        all_clips = []
        all_clips.extend(extract_clips_from_chapters(analysis_data))
        all_clips.extend(extract_clips_from_highlights(analysis_data))
        all_clips.extend(extract_clips_from_segments(analysis_data))

        # If we don't have enough clips, add evenly spaced fillers
        if len(all_clips) < max_clips:
            duration = get_video_duration(video_path)
            if duration > 0:
                filler_clips = generate_evenly_spaced_clips(duration, max_clips - len(all_clips))
                all_clips.extend(filler_clips)

        # Sort by priority (highest first) and deduplicate by start time
        all_clips.sort(key=lambda x: x.priority, reverse=True)

        # Deduplicate — remove clips with start times within 60 seconds of each other
        seen_times = set()
        unique_clips = []

        for clip in all_clips:
            start_secs = parse_timestamp(clip.start_time)
            too_close = False
            for seen in seen_times:
                if abs(start_secs - seen) < 60:
                    too_close = True
                    break

            if not too_close:
                seen_times.add(start_secs)
                unique_clips.append(clip)

        clip_infos = unique_clips[:max_clips]

    # Sort by start time for consistent ordering
    clip_infos.sort(key=lambda x: parse_timestamp(x.start_time))

    # Extract clips
    extracted = []

    for i, clip_info in enumerate(clip_infos, 1):
        desc_slug = sanitize_filename(clip_info.description)
        clip_filename = f"{i:02d}-{desc_slug}.mp4"
        clip_path = os.path.join(clips_dir, clip_filename)

        success = extract_clip(
            video_path,
            clip_path,
            clip_info.start_time,
            clip_info.duration
        )

        if success and os.path.exists(clip_path):
            extracted.append(clip_path)

    return extracted


if __name__ == "__main__":
    import sys

    if len(sys.argv) >= 3:
        video_path = sys.argv[1]
        output_dir = sys.argv[2]
        max_clips = int(sys.argv[3]) if len(sys.argv) > 3 else 10

        print(f"Extracting up to {max_clips} clips from {video_path}")
        clips = extract_clips_from_analysis(video_path, output_dir, max_clips)

        print(f"\nExtracted {len(clips)} clips:")
        for clip in clips:
            print(f"  - {os.path.basename(clip)}")
    else:
        print("Usage: python extract_clips.py <video_path> <output_dir> [max_clips]")

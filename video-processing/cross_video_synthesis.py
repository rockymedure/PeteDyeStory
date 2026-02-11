#!/usr/bin/env python3
"""
Cross-Video Synthesis - Pete Dye Story
Analyzes all processed videos together to build unified knowledge.

Usage:
    python cross_video_synthesis.py
    python cross_video_synthesis.py --output-dir path/to/output

Reads: video-processing/output/*/analysis/simple_director_analysis.json
Writes: video-processing/output/cross_video_synthesis/
    - unified_timeline.json
    - character_profiles.json
    - thematic_index.json
    - coverage_report.json
    - synthesis_report.md (human-readable)
"""

import argparse
import glob
import json
import os
import re
import sys
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Environment / API key loading (same pattern as run_video.py)
# ---------------------------------------------------------------------------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def load_env():
    """Load .env file from the video-processing directory."""
    env_path = os.path.join(SCRIPT_DIR, '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    if key and value and key not in os.environ:
                        os.environ[key] = value


load_env()


# ---------------------------------------------------------------------------
# Scanning & loading
# ---------------------------------------------------------------------------

def find_analysis_files(output_base_dir: str) -> List[str]:
    """
    Scan all output directories for simple_director_analysis.json files.
    Returns sorted list of absolute paths.
    """
    pattern = os.path.join(output_base_dir, '*', 'analysis', 'simple_director_analysis.json')
    paths = sorted(glob.glob(pattern))
    return paths


def load_analysis(path: str) -> Optional[Dict[str, Any]]:
    """Load and return a single analysis JSON, or None on error."""
    try:
        with open(path, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError) as exc:
        print(f"  WARNING: Could not load {path}: {exc}")
        return None


def video_name_from_path(analysis_path: str) -> str:
    """Derive a human-friendly video name from its analysis file path."""
    # .../output/<video_name>/analysis/simple_director_analysis.json
    parts = analysis_path.replace('\\', '/').split('/')
    try:
        idx = parts.index('analysis')
        return parts[idx - 1]
    except (ValueError, IndexError):
        return os.path.basename(os.path.dirname(os.path.dirname(analysis_path)))


# ---------------------------------------------------------------------------
# Data extraction helpers
# ---------------------------------------------------------------------------

def _get_video_analysis(data: dict) -> dict:
    """Safely get video_analysis sub-dict."""
    return data.get('video_analysis', {})


def extract_characters(va: dict) -> List[dict]:
    """Return the characters list from a video_analysis dict."""
    chars = va.get('characters')
    if chars and isinstance(chars, list):
        return chars
    return []


def extract_chapters(va: dict) -> List[dict]:
    """Return chapters list from a video_analysis dict."""
    chapters = va.get('chapters')
    if chapters and isinstance(chapters, list):
        return chapters
    return []


def extract_highlights(va: dict) -> List[dict]:
    """Return highlights list from a video_analysis dict."""
    highlights = va.get('highlights')
    if highlights and isinstance(highlights, list):
        return highlights
    return []


def extract_quotes(va: dict) -> List[dict]:
    """Return quotes list from a video_analysis dict."""
    quotes = va.get('quotes')
    if quotes and isinstance(quotes, list):
        return quotes
    return []


def extract_themes(va: dict) -> List[str]:
    """Return themes list from a video_analysis dict."""
    themes = va.get('themes')
    if themes and isinstance(themes, list):
        return [str(t) for t in themes]
    return []


def guess_date_from_name(video_name: str) -> str:
    """
    Attempt to extract a year or date estimate from the video directory name.
    E.g. 'Aug_1985_PDGC_Construction' -> '1985'
    Returns empty string if nothing found.
    """
    match = re.search(r'((?:19|20)\d{2})', video_name)
    return match.group(1) if match else ''


def guess_time_period(year_str: str) -> str:
    """
    Bucket a year string into a time-period range for the coverage report.
    Returns a range like '1978-1985' or empty string.
    """
    if not year_str:
        return 'Unknown'
    try:
        year = int(year_str)
    except ValueError:
        return 'Unknown'

    if year < 1978:
        return 'Pre-1978'
    elif year <= 1985:
        return '1978-1985'
    elif year <= 1990:
        return '1985-1990'
    elif year <= 1995:
        return '1990-1995'
    elif year <= 2000:
        return '1995-2000'
    elif year <= 2004:
        return '2000-2004'
    else:
        return 'Post-2004'


# ---------------------------------------------------------------------------
# Builders — each produces one output artifact
# ---------------------------------------------------------------------------

def build_unified_timeline(all_videos: List[dict]) -> dict:
    """
    Build a chronological timeline of events across all videos.

    Returns:
        {"events": [...sorted by date_estimate...]}
    """
    events: List[dict] = []

    for entry in all_videos:
        video_name = entry['video_name']
        va = entry['video_analysis']
        date_est = guess_date_from_name(video_name)

        # One event per chapter
        for chapter in extract_chapters(va):
            events.append({
                'date_estimate': date_est,
                'title': chapter.get('title', 'Untitled'),
                'video': video_name,
                'chapter': chapter.get('title', ''),
                'start_time': chapter.get('start_time', ''),
                'end_time': chapter.get('end_time', ''),
                'summary': chapter.get('summary', ''),
                'characters': chapter.get('characters_present', []),
            })

        # Also surface key highlights as events
        for hl in extract_highlights(va):
            events.append({
                'date_estimate': date_est,
                'title': hl.get('title', hl.get('description', 'Highlight')),
                'video': video_name,
                'chapter': None,
                'start_time': hl.get('timestamp', ''),
                'end_time': None,
                'summary': hl.get('description', ''),
                'characters': hl.get('characters_involved', []),
            })

    # Sort: videos with dates first (ascending), then undated
    def sort_key(e):
        d = e.get('date_estimate', '')
        return (0 if d else 1, d, e.get('video', ''), e.get('start_time', ''))

    events.sort(key=sort_key)

    return {'events': events}


def build_character_profiles(all_videos: List[dict]) -> dict:
    """
    Build aggregated character profiles across all videos.

    Returns:
        {"characters": [{name, appearances, total_videos, total_quotes, themes_associated}, ...]}
    """
    # Normalize name for deduplication
    char_map: Dict[str, dict] = {}  # lowercase name -> profile dict

    for entry in all_videos:
        video_name = entry['video_name']
        va = entry['video_analysis']
        video_themes = extract_themes(va)

        # Characters from the characters array
        for char in extract_characters(va):
            name = char.get('name', '').strip()
            if not name:
                continue

            key = name.lower()
            if key not in char_map:
                char_map[key] = {
                    'name': name,
                    'appearances': [],
                    'total_videos': 0,
                    'total_quotes': 0,
                    'themes_associated': set(),
                    '_seen_videos': set(),
                }

            profile = char_map[key]

            # Build an appearance entry for this video
            appearance: Dict[str, Any] = {
                'video': video_name,
                'role': char.get('role', ''),
                'is_speaking': char.get('is_speaking', False),
                'description': char.get('description', ''),
                'quotes': [],
            }

            # Collect quotes from this video for this character
            for q in extract_quotes(va):
                if q.get('speaker', '').lower() == key:
                    appearance['quotes'].append({
                        'text': q.get('text', ''),
                        'timestamp': q.get('timestamp', ''),
                        'context': q.get('context', ''),
                    })

            profile['appearances'].append(appearance)
            profile['total_quotes'] += len(appearance['quotes'])
            profile['themes_associated'].update(video_themes)

            if video_name not in profile['_seen_videos']:
                profile['_seen_videos'].add(video_name)
                profile['total_videos'] += 1

    # Finalize — convert sets to sorted lists, drop internal bookkeeping
    characters = []
    for profile in sorted(char_map.values(), key=lambda p: p['total_videos'], reverse=True):
        characters.append({
            'name': profile['name'],
            'appearances': profile['appearances'],
            'total_videos': profile['total_videos'],
            'total_quotes': profile['total_quotes'],
            'themes_associated': sorted(profile['themes_associated']),
        })

    return {'characters': characters}


def build_thematic_index(all_videos: List[dict]) -> dict:
    """
    Build theme-centric index mapping themes to videos, characters, and quotes.

    Returns:
        {"themes": [{theme, videos, related_characters, key_quotes}, ...]}
    """
    theme_map: Dict[str, dict] = {}

    for entry in all_videos:
        video_name = entry['video_name']
        va = entry['video_analysis']

        for theme_str in extract_themes(va):
            theme_key = theme_str.lower().strip()
            if not theme_key:
                continue

            if theme_key not in theme_map:
                theme_map[theme_key] = {
                    'theme': theme_key,
                    'videos': [],
                    'related_characters': set(),
                    'key_quotes': [],
                }

            bucket = theme_map[theme_key]

            if video_name not in bucket['videos']:
                bucket['videos'].append(video_name)

            # Characters from this video contribute to this theme
            for char in extract_characters(va):
                name = char.get('name', '').strip()
                if name:
                    bucket['related_characters'].add(name)

            # Surface quotes
            for q in extract_quotes(va):
                bucket['key_quotes'].append({
                    'text': q.get('text', ''),
                    'speaker': q.get('speaker', ''),
                    'video': video_name,
                })

    # Finalize
    themes = []
    for bucket in sorted(theme_map.values(), key=lambda b: len(b['videos']), reverse=True):
        themes.append({
            'theme': bucket['theme'],
            'videos': bucket['videos'],
            'related_characters': sorted(bucket['related_characters']),
            'key_quotes': bucket['key_quotes'],
        })

    return {'themes': themes}


def build_coverage_report(all_videos: List[dict]) -> dict:
    """
    Build a high-level coverage/statistics report.

    Returns:
        {total_videos, total_characters, content_type_breakdown,
         time_period_coverage, footage_gaps, most_featured_characters}
    """
    total_videos = len(all_videos)
    all_characters: set = set()
    content_types: Dict[str, int] = defaultdict(int)
    period_counts: Dict[str, int] = defaultdict(int)
    years_seen: set = set()
    char_video_counts: Dict[str, int] = defaultdict(int)

    for entry in all_videos:
        video_name = entry['video_name']
        va = entry['video_analysis']

        # Content type
        ct = va.get('content_type', 'unknown')
        content_types[ct] += 1

        # Characters
        for char in extract_characters(va):
            name = char.get('name', '').strip()
            if name:
                all_characters.add(name)
                char_video_counts[name] += 1

        # Time period
        year_str = guess_date_from_name(video_name)
        period = guess_time_period(year_str)
        period_counts[period] += 1
        if year_str:
            try:
                years_seen.add(int(year_str))
            except ValueError:
                pass

    # Detect footage gaps (years with no video in the 1978-2004 range)
    footage_gaps: List[str] = []
    if years_seen:
        min_year = max(min(years_seen), 1978)
        max_year = min(max(years_seen), 2004)
        gap_start = None
        for y in range(min_year, max_year + 1):
            if y not in years_seen:
                if gap_start is None:
                    gap_start = y
            else:
                if gap_start is not None:
                    gap_end = y - 1
                    if gap_start == gap_end:
                        footage_gaps.append(f"No footage from {gap_start}")
                    else:
                        footage_gaps.append(f"No footage from {gap_start}-{gap_end}")
                    gap_start = None
        if gap_start is not None:
            gap_end = max_year
            if gap_start == gap_end:
                footage_gaps.append(f"No footage from {gap_start}")
            else:
                footage_gaps.append(f"No footage from {gap_start}-{gap_end}")

    # Most featured characters (sorted by appearance count)
    most_featured = sorted(char_video_counts.items(), key=lambda x: x[1], reverse=True)

    return {
        'total_videos': total_videos,
        'total_characters': len(all_characters),
        'content_type_breakdown': dict(content_types),
        'time_period_coverage': dict(period_counts),
        'footage_gaps': footage_gaps,
        'most_featured_characters': [
            {'name': name, 'video_count': count} for name, count in most_featured
        ],
    }


# ---------------------------------------------------------------------------
# GPT-5.1 narrative synthesis (optional)
# ---------------------------------------------------------------------------

def generate_narrative_synthesis(
    coverage_report: dict,
    character_profiles: dict,
    thematic_index: dict,
    unified_timeline: dict,
) -> Optional[str]:
    """
    Send aggregated data to GPT-5.1 for a narrative meta-synthesis.
    Returns the narrative text, or None if the API call fails or is unavailable.
    """
    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        print("  No OPENAI_API_KEY found — skipping GPT-5.1 narrative synthesis.")
        return None

    try:
        from openai import OpenAI
    except ImportError:
        print("  openai package not installed — skipping GPT-5.1 narrative synthesis.")
        return None

    client = OpenAI(api_key=api_key)

    # Build a concise context payload (trim to avoid exceeding context window)
    top_characters = character_profiles.get('characters', [])[:10]
    char_summary = "\n".join(
        f"  - {c['name']}: {c['total_videos']} videos, {c['total_quotes']} quotes"
        for c in top_characters
    )

    top_themes = thematic_index.get('themes', [])[:10]
    theme_summary = "\n".join(
        f"  - {t['theme']}: appears in {len(t['videos'])} videos"
        for t in top_themes
    )

    timeline_events = unified_timeline.get('events', [])
    timeline_summary_items = []
    for evt in timeline_events[:30]:
        date = evt.get('date_estimate', '?')
        title = evt.get('title', '')
        video = evt.get('video', '')
        timeline_summary_items.append(f"  - [{date}] {title} (from {video})")
    timeline_summary = "\n".join(timeline_summary_items)

    cr = coverage_report
    gaps = ", ".join(cr.get('footage_gaps', [])) or "None detected"

    prompt = f"""You are a documentary researcher synthesizing findings across an entire video archive
for "The Pete Dye Story" — the 25-year journey (1978-2004) of building the Pete Dye Golf Club
in West Virginia.

Here is the aggregated data from {cr['total_videos']} processed videos:

## Coverage
- Total videos analyzed: {cr['total_videos']}
- Total unique characters: {cr['total_characters']}
- Content types: {json.dumps(cr.get('content_type_breakdown', {}), indent=2)}
- Time periods: {json.dumps(cr.get('time_period_coverage', {}), indent=2)}
- Footage gaps: {gaps}

## Key Characters
{char_summary}

## Recurring Themes
{theme_summary}

## Timeline (sample of {len(timeline_events)} events)
{timeline_summary}

---

Write a 600-800 word NARRATIVE SYNTHESIS for the producer. Cover:
1. The overall arc of the story as told through the footage
2. Which characters emerge as central and why
3. Key thematic threads and how they weave through the archive
4. Notable gaps or areas where additional footage/interviews would strengthen the documentary
5. Recommendations for the narrative structure of the final documentary

Write in a professional but engaging tone, as if preparing a research brief for a documentary director.
"""

    try:
        print("  Sending to GPT-5.1 for narrative synthesis...")
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            max_completion_tokens=8000,
            temperature=0.3,
        )
        return response.choices[0].message.content
    except Exception as exc:
        print(f"  WARNING: GPT narrative synthesis failed: {exc}")
        return None


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

def generate_synthesis_report(
    coverage_report: dict,
    character_profiles: dict,
    thematic_index: dict,
    unified_timeline: dict,
    narrative: Optional[str],
) -> str:
    """Build the human-readable synthesis_report.md content."""
    lines: List[str] = []
    lines.append("# Cross-Video Synthesis Report")
    lines.append(f"# Pete Dye Story — Archive Analysis")
    lines.append(f"")
    lines.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")

    # --- Coverage overview ---
    cr = coverage_report
    lines.append("## Coverage Overview")
    lines.append("")
    lines.append(f"- **Total videos analyzed**: {cr['total_videos']}")
    lines.append(f"- **Total unique characters**: {cr['total_characters']}")
    lines.append("")

    lines.append("### Content Types")
    lines.append("")
    for ct, count in sorted(cr.get('content_type_breakdown', {}).items(), key=lambda x: -x[1]):
        lines.append(f"- {ct}: {count} videos")
    lines.append("")

    lines.append("### Time Period Coverage")
    lines.append("")
    for period, count in sorted(cr.get('time_period_coverage', {}).items()):
        lines.append(f"- {period}: {count} videos")
    lines.append("")

    if cr.get('footage_gaps'):
        lines.append("### Footage Gaps")
        lines.append("")
        for gap in cr['footage_gaps']:
            lines.append(f"- {gap}")
        lines.append("")

    # --- Characters ---
    lines.append("## Characters")
    lines.append("")
    for char in character_profiles.get('characters', [])[:15]:
        name = char['name']
        vids = char['total_videos']
        quotes = char['total_quotes']
        themes = ', '.join(char.get('themes_associated', [])[:5]) or 'N/A'
        lines.append(f"### {name}")
        lines.append(f"- Appears in **{vids}** videos, **{quotes}** quotes")
        lines.append(f"- Associated themes: {themes}")

        # Sample quotes
        all_quotes = []
        for app in char.get('appearances', []):
            for q in app.get('quotes', []):
                all_quotes.append(q)
        for q in all_quotes[:3]:
            lines.append(f'  > "{q["text"]}" — *{q.get("context", "")}*')

        lines.append("")

    # --- Themes ---
    lines.append("## Thematic Index")
    lines.append("")
    for theme in thematic_index.get('themes', [])[:15]:
        t = theme['theme']
        vcount = len(theme.get('videos', []))
        chars = ', '.join(theme.get('related_characters', [])[:5])
        lines.append(f"### {t.title()}")
        lines.append(f"- Found in **{vcount}** videos")
        lines.append(f"- Related characters: {chars}")
        for q in theme.get('key_quotes', [])[:2]:
            lines.append(f'  > "{q["text"]}" — {q.get("speaker", "Unknown")} (from {q.get("video", "")})')
        lines.append("")

    # --- Timeline highlights ---
    lines.append("## Timeline Highlights")
    lines.append("")
    events = unified_timeline.get('events', [])
    for evt in events[:25]:
        date = evt.get('date_estimate', '?')
        title = evt.get('title', '')
        video = evt.get('video', '')
        chars = ', '.join(evt.get('characters', []))
        char_note = f" [{chars}]" if chars else ""
        lines.append(f"- **[{date}]** {title}{char_note} — *{video}*")
    if len(events) > 25:
        lines.append(f"- ... and {len(events) - 25} more events (see unified_timeline.json)")
    lines.append("")

    # --- Narrative (GPT-5.1) ---
    if narrative:
        lines.append("## Narrative Synthesis (AI-Generated)")
        lines.append("")
        lines.append(narrative)
        lines.append("")

    # --- Most featured ---
    lines.append("## Most Featured Characters")
    lines.append("")
    lines.append("| Character | Videos |")
    lines.append("|-----------|--------|")
    for entry in cr.get('most_featured_characters', [])[:10]:
        lines.append(f"| {entry['name']} | {entry['video_count']} |")
    lines.append("")

    lines.append("---")
    lines.append("*Report generated by cross_video_synthesis.py*")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def run_synthesis(output_base_dir: str) -> None:
    """
    Main entry point. Scans output directories, builds all artifacts,
    and writes them to the cross_video_synthesis subdirectory.
    """
    print("=" * 60)
    print("CROSS-VIDEO SYNTHESIS — Pete Dye Story")
    print("=" * 60)
    start_time = time.time()

    # 1. Find all analysis files
    print(f"\nScanning: {output_base_dir}/*/analysis/simple_director_analysis.json")
    analysis_paths = find_analysis_files(output_base_dir)
    print(f"Found {len(analysis_paths)} analysis files.")

    if not analysis_paths:
        print("ERROR: No analysis files found. Run video processing first.")
        sys.exit(1)

    # 2. Load all structured data
    print("\nLoading analysis data...")
    all_videos: List[dict] = []

    for path in analysis_paths:
        data = load_analysis(path)
        if data is None:
            continue

        video_name = video_name_from_path(path)
        va = _get_video_analysis(data)

        all_videos.append({
            'video_name': video_name,
            'video_analysis': va,
            'raw_segments': data.get('raw_segments', []),
            'processing_metadata': data.get('processing_metadata', {}),
        })

    print(f"Successfully loaded {len(all_videos)} videos.")

    if not all_videos:
        print("ERROR: No valid analysis data found.")
        sys.exit(1)

    # 3. Build aggregated structures
    print("\nBuilding unified timeline...")
    unified_timeline = build_unified_timeline(all_videos)
    print(f"  {len(unified_timeline['events'])} events")

    print("Building character profiles...")
    character_profiles = build_character_profiles(all_videos)
    print(f"  {len(character_profiles['characters'])} unique characters")

    print("Building thematic index...")
    thematic_index = build_thematic_index(all_videos)
    print(f"  {len(thematic_index['themes'])} themes")

    print("Building coverage report...")
    coverage_report = build_coverage_report(all_videos)
    print(f"  {coverage_report['total_videos']} videos, {coverage_report['total_characters']} characters")

    # 4. Optional GPT-5.1 narrative synthesis
    narrative = generate_narrative_synthesis(
        coverage_report,
        character_profiles,
        thematic_index,
        unified_timeline,
    )

    # 5. Write output files
    synthesis_dir = os.path.join(output_base_dir, 'cross_video_synthesis')
    os.makedirs(synthesis_dir, exist_ok=True)
    print(f"\nWriting output to: {synthesis_dir}")

    def write_json(filename: str, data: Any) -> None:
        path = os.path.join(synthesis_dir, filename)
        with open(path, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        print(f"  Wrote {filename} ({os.path.getsize(path):,} bytes)")

    write_json('unified_timeline.json', unified_timeline)
    write_json('character_profiles.json', character_profiles)
    write_json('thematic_index.json', thematic_index)
    write_json('coverage_report.json', coverage_report)

    # 6. Generate human-readable report
    report_md = generate_synthesis_report(
        coverage_report,
        character_profiles,
        thematic_index,
        unified_timeline,
        narrative,
    )
    report_path = os.path.join(synthesis_dir, 'synthesis_report.md')
    with open(report_path, 'w') as f:
        f.write(report_md)
    print(f"  Wrote synthesis_report.md ({os.path.getsize(report_path):,} bytes)")

    # Done
    elapsed = time.time() - start_time
    print(f"\nSynthesis complete in {elapsed:.1f}s")
    print(f"Output directory: {synthesis_dir}")
    print("=" * 60)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Cross-Video Synthesis for the Pete Dye Story archive"
    )
    parser.add_argument(
        '--output-dir',
        default=os.path.join(SCRIPT_DIR, 'output'),
        help='Base output directory containing per-video results (default: video-processing/output)',
    )
    args = parser.parse_args()

    output_dir = os.path.abspath(args.output_dir)
    if not os.path.isdir(output_dir):
        print(f"ERROR: Output directory not found: {output_dir}")
        sys.exit(1)

    run_synthesis(output_dir)


if __name__ == "__main__":
    main()

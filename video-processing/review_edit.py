#!/usr/bin/env python3
"""
Pete Dye Story - Edit Review Agent

Processes a rough cut through the video analysis pipeline, then compares
it against FILM-OUTLINE.md to produce an editorial guide with specific
recommendations for aligning the edit to the documentary's intended arc.

Usage:
    python review_edit.py /path/to/rough_cut.mp4
    python review_edit.py /path/to/rough_cut.mp4 --skip-processing
    python review_edit.py /path/to/rough_cut.mp4 --reprocess
"""

import argparse
import asyncio
import json
import os
import re
import sys
import time

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
from openai import OpenAI


REVIEW_SCHEMA = {
    "type": "object",
    "properties": {
        "overall_assessment": {
            "type": "string"
        },
        "act_alignment": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "act_name": {"type": "string"},
                    "covered_content": {"type": "string"},
                    "coverage_gaps": {"type": "string"},
                    "notes": {"type": "string"}
                },
                "required": ["act_name", "covered_content", "coverage_gaps", "notes"],
                "additionalProperties": False
            }
        },
        "key_moments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "moment_name": {"type": "string"},
                    "present": {"type": "boolean"},
                    "position_notes": {"type": "string"},
                    "recommendation": {"type": "string"}
                },
                "required": ["moment_name", "present", "position_notes", "recommendation"],
                "additionalProperties": False
            }
        },
        "theme_coverage": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "theme": {"type": "string"},
                    "strength": {
                        "type": "string",
                        "enum": ["strong", "moderate", "weak", "absent"]
                    },
                    "notes": {"type": "string"}
                },
                "required": ["theme", "strength", "notes"],
                "additionalProperties": False
            }
        },
        "character_coverage": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "prominence": {
                        "type": "string",
                        "enum": ["central", "supporting", "minor", "absent"]
                    },
                    "notes": {"type": "string"}
                },
                "required": ["name", "prominence", "notes"],
                "additionalProperties": False
            }
        },
        "structural_notes": {
            "type": "string"
        },
        "recommendations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "priority": {"type": "integer"},
                    "action": {
                        "type": "string",
                        "enum": ["add", "cut", "reorder", "emphasize", "de-emphasize"]
                    },
                    "description": {"type": "string"}
                },
                "required": ["priority", "action", "description"],
                "additionalProperties": False
            }
        }
    },
    "required": [
        "overall_assessment", "act_alignment", "key_moments",
        "theme_coverage", "character_coverage", "structural_notes",
        "recommendations"
    ],
    "additionalProperties": False
}


def load_outline() -> str:
    """Load FILM-OUTLINE.md from the project root."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    outline_path = os.path.join(base_dir, '..', 'FILM-OUTLINE.md')
    outline_path = os.path.normpath(outline_path)

    if not os.path.exists(outline_path):
        print(f"Error: FILM-OUTLINE.md not found at {outline_path}")
        sys.exit(1)

    with open(outline_path, 'r') as f:
        return f.read()


def get_video_output_dir(video_path: str, base_dir: str) -> str:
    """Derive the output directory for a given video (matches SimpleDirector convention)."""
    video_name = os.path.splitext(os.path.basename(video_path))[0]
    video_name = re.sub(r'[^\w\-_]', '_', video_name)
    return os.path.join(base_dir, 'output', video_name)


def load_existing_analysis(output_dir: str) -> dict | None:
    """Load previously generated analysis JSON if it exists."""
    analysis_path = os.path.join(output_dir, 'analysis', 'simple_director_analysis.json')
    if os.path.exists(analysis_path):
        with open(analysis_path, 'r') as f:
            return json.load(f)
    return None


def load_existing_transcript(output_dir: str) -> str:
    """Load previously generated transcript if it exists."""
    transcript_path = os.path.join(output_dir, 'analysis', 'full_transcript.txt')
    if os.path.exists(transcript_path):
        with open(transcript_path, 'r') as f:
            return f.read()
    return ""


def run_comparison(analysis: dict, transcript: str, outline: str, model: str = "gpt-5.1") -> dict:
    """Send analysis + outline to GPT-5.1 for structured editorial comparison."""
    client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

    video_analysis = analysis.get('video_analysis', {})
    analysis_json = json.dumps(video_analysis, indent=2)

    system_message = (
        "You are an experienced documentary film editor reviewing a rough cut against a "
        "story outline. Your job is to produce specific, actionable editorial guidance — "
        "not a generic critique. Reference timestamps from the rough cut analysis so the "
        "editor can locate the moments you're discussing.\n\n"
        "The outline defines a 3-act documentary structure with specific emotional anchor "
        "moments, themes, and central characters. Compare what's in the rough cut to what "
        "the outline calls for, and produce clear instructions for the editor."
    )

    user_message = (
        "Compare this rough cut analysis against the documentary outline below. "
        "Produce a structured editorial review.\n\n"
        "=== ROUGH CUT ANALYSIS (structured) ===\n"
        f"{analysis_json}\n\n"
        "=== ROUGH CUT FULL TRANSCRIPT ===\n"
        f"{transcript}\n\n"
        "=== DOCUMENTARY OUTLINE ===\n"
        f"{outline}\n\n"
        "Based on the above, produce your editorial review. For each act, identify what "
        "the rough cut covers and what's missing relative to the outline. Check whether "
        "the 3 key emotional moments (Pete names the club, the bell on #12, Opening Day) "
        "are present and positioned correctly. Assess the 5 themes (Perseverance, "
        "Partnership, WV Pride, Heritage, Legacy) and 4 central characters (James D. "
        "LaRosa, Jimmy LaRosa, Pete Dye, Alice Dye). Then provide a prioritized list of "
        "the most impactful editorial changes, written as direct instructions to the editor. "
        "Reference specific timestamps from the rough cut where possible."
    )

    print(f"   Sending to {model} for editorial comparison...")
    start = time.time()

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message}
        ],
        max_completion_tokens=12000,
        temperature=0.2,
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "edit_review",
                "strict": True,
                "schema": REVIEW_SCHEMA
            }
        }
    )

    elapsed = time.time() - start
    print(f"   Comparison complete in {elapsed:.0f}s")

    return json.loads(response.choices[0].message.content)


def generate_editorial_guide(review: dict, video_name: str) -> str:
    """Generate the human-readable editorial guide markdown from structured review data."""
    lines = []

    lines.append(f"# Editorial Review: {video_name}")
    lines.append("")
    lines.append(f"*Generated {time.strftime('%Y-%m-%d %H:%M')} — compared against FILM-OUTLINE.md*")
    lines.append("")
    lines.append("---")
    lines.append("")

    # 1. Executive Summary
    lines.append("## Executive Summary")
    lines.append("")
    lines.append(review.get("overall_assessment", ""))
    lines.append("")

    # 2. Act-by-Act Walkthrough
    lines.append("---")
    lines.append("")
    lines.append("## Act-by-Act Walkthrough")
    lines.append("")

    for act in review.get("act_alignment", []):
        lines.append(f"### {act['act_name']}")
        lines.append("")
        lines.append("**What's covered:**")
        lines.append(act["covered_content"])
        lines.append("")
        lines.append("**What's missing:**")
        lines.append(act["coverage_gaps"])
        lines.append("")
        if act.get("notes"):
            lines.append(f"**Notes:** {act['notes']}")
            lines.append("")

    # 3. Key Moments Checklist
    lines.append("---")
    lines.append("")
    lines.append("## Key Moments Checklist")
    lines.append("")
    lines.append("| Moment | Present | Status |")
    lines.append("|--------|---------|--------|")

    for moment in review.get("key_moments", []):
        present = "Yes" if moment["present"] else "**NO**"
        lines.append(f"| {moment['moment_name']} | {present} | {moment['position_notes']} |")

    lines.append("")

    for moment in review.get("key_moments", []):
        if moment.get("recommendation"):
            lines.append(f"- **{moment['moment_name']}:** {moment['recommendation']}")

    lines.append("")

    # 4. Theme & Character Notes
    lines.append("---")
    lines.append("")
    lines.append("## Theme Coverage")
    lines.append("")
    lines.append("| Theme | Strength | Notes |")
    lines.append("|-------|----------|-------|")

    for theme in review.get("theme_coverage", []):
        strength = theme["strength"].upper()
        lines.append(f"| {theme['theme']} | {strength} | {theme['notes']} |")

    lines.append("")
    lines.append("## Character Coverage")
    lines.append("")
    lines.append("| Character | Prominence | Notes |")
    lines.append("|-----------|------------|-------|")

    for char in review.get("character_coverage", []):
        prominence = char["prominence"].upper()
        lines.append(f"| {char['name']} | {prominence} | {char['notes']} |")

    lines.append("")

    # Structural notes
    if review.get("structural_notes"):
        lines.append("## Structural Notes")
        lines.append("")
        lines.append(review["structural_notes"])
        lines.append("")

    # 5. Priority Punch List
    lines.append("---")
    lines.append("")
    lines.append("## Priority Punch List")
    lines.append("")
    lines.append("Ordered by impact — the most important changes first.")
    lines.append("")

    for rec in sorted(review.get("recommendations", []), key=lambda r: r["priority"]):
        action_label = rec["action"].upper().replace("-", " ")
        lines.append(f"{rec['priority']}. **[{action_label}]** {rec['description']}")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append(f"*Review generated from FILM-OUTLINE.md comparison — {time.strftime('%B %d, %Y')}*")
    lines.append("")

    return "\n".join(lines)


async def run_pipeline(video_path: str, skip_processing: bool = False,
                       reprocess: bool = False, model: str = "gpt-5.1",
                       segment_duration: int = 150):
    """Full review pipeline: process video -> compare to outline -> generate editorial guide."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = get_video_output_dir(video_path, base_dir)

    print()
    print("=" * 60)
    print("  PETE DYE STORY — EDIT REVIEW AGENT")
    print("=" * 60)
    print(f"  Video:   {os.path.basename(video_path)}")
    print(f"  Model:   {model}")
    print(f"  Outline: FILM-OUTLINE.md")
    print("=" * 60)
    print()

    # --- Phase 1: Video Analysis ---
    existing_analysis = load_existing_analysis(output_dir)

    if skip_processing and existing_analysis:
        print("Phase 1: SKIPPED (using existing analysis)")
        print(f"   Found: {output_dir}/analysis/simple_director_analysis.json")
        analysis = existing_analysis
    elif existing_analysis and not reprocess:
        print("Phase 1: SKIPPED (analysis already exists, use --reprocess to force)")
        print(f"   Found: {output_dir}/analysis/simple_director_analysis.json")
        analysis = existing_analysis
    else:
        print("Phase 1: Processing video through analysis pipeline...")
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        if not openai_api_key:
            print("Error: OPENAI_API_KEY not found")
            sys.exit(1)

        director = SimpleDirector(
            openai_api_key,
            base_dir=base_dir,
            model=model
        )
        analysis = await director.analyze_video(video_path, segment_duration=segment_duration)

        if not analysis:
            print("Error: Video analysis failed")
            sys.exit(1)

    transcript = load_existing_transcript(output_dir)
    print()

    # --- Phase 2: Comparison ---
    print("Phase 2: Comparing rough cut to FILM-OUTLINE.md...")
    outline = load_outline()
    review = run_comparison(analysis, transcript, outline, model=model)
    print()

    # --- Phase 3: Generate outputs ---
    print("Phase 3: Generating editorial guide...")
    analysis_dir = os.path.join(output_dir, 'analysis')
    os.makedirs(analysis_dir, exist_ok=True)

    video_name = os.path.splitext(os.path.basename(video_path))[0]

    # Save JSON
    json_path = os.path.join(analysis_dir, 'edit_review.json')
    with open(json_path, 'w') as f:
        json.dump(review, f, indent=2)

    # Save editorial guide markdown
    md_content = generate_editorial_guide(review, video_name)
    md_path = os.path.join(analysis_dir, 'edit_review.md')
    with open(md_path, 'w') as f:
        f.write(md_content)

    print()
    print("=" * 60)
    print("  REVIEW COMPLETE")
    print("=" * 60)
    print(f"  Editorial Guide: {md_path}")
    print(f"  Structured Data: {json_path}")
    print("=" * 60)
    print()

    return review


def main():
    parser = argparse.ArgumentParser(
        description='Pete Dye Story - Edit Review Agent',
        epilog='Compares a rough cut against FILM-OUTLINE.md and produces editorial guidance.'
    )
    parser.add_argument('video_path', help='Path to the rough cut video file')
    parser.add_argument('--skip-processing', action='store_true',
                        help='Skip video analysis (requires existing analysis output)')
    parser.add_argument('--reprocess', action='store_true',
                        help='Force re-analysis even if output already exists')
    parser.add_argument('--model', choices=['gpt-4o', 'gpt-5.1'], default='gpt-5.1',
                        help='AI model to use (default: gpt-5.1)')
    parser.add_argument('--segment-duration', type=int, default=150,
                        help='Seconds per video segment (default: 150)')

    args = parser.parse_args()

    if not os.path.exists(args.video_path):
        print(f"Error: Video file not found: {args.video_path}")
        sys.exit(1)

    asyncio.run(run_pipeline(
        args.video_path,
        skip_processing=args.skip_processing,
        reprocess=args.reprocess,
        model=args.model,
        segment_duration=args.segment_duration
    ))


if __name__ == "__main__":
    main()

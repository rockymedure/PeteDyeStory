#!/usr/bin/env python3
"""
Video Output Validation Module

Validates that video processing completed successfully by checking:
1. Output directory exists
2. Analysis MD file exists and has content
3. Analysis JSON is valid and has required fields
4. Transcript file exists and has content
5. Structured JSON schema fields (warnings only for backward compatibility)
"""

import os
import json
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ValidationResult:
    """Result of video output validation"""
    passed: bool = False
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)
    
    def add_issue(self, issue: str):
        self.issues.append(issue)
        self.passed = False
    
    def add_warning(self, warning: str):
        self.warnings.append(warning)


def validate_structured_fields(data: dict, result: ValidationResult):
    """
    Validate the new structured JSON schema fields.
    
    Checks video_analysis for required structured fields:
    - title (string), content_type (string), summary (string)
    - characters[], chapters[], highlights[], quotes[], themes[]
    - Each character must have name and is_speaking
    - Each chapter must have title, start_time, end_time
    
    All issues are added as warnings (not failures) to maintain
    backward compatibility with the old format.
    
    Args:
        data: The parsed JSON data from simple_director_analysis.json
        result: ValidationResult to add warnings to
    """
    video_analysis = data.get('video_analysis')
    if not video_analysis:
        result.add_warning("Structured schema: 'video_analysis' key missing, cannot validate structured fields")
        return
    
    # If video_analysis is a string (old format), skip structured validation
    if isinstance(video_analysis, str):
        result.add_warning("Structured schema: 'video_analysis' is a string (old format), skipping structured field validation")
        return
    
    if not isinstance(video_analysis, dict):
        result.add_warning(f"Structured schema: 'video_analysis' is {type(video_analysis).__name__}, expected dict")
        return
    
    # Check required string fields
    for field_name in ('title', 'content_type', 'summary'):
        value = video_analysis.get(field_name)
        if value is None:
            result.add_warning(f"Structured schema: 'video_analysis.{field_name}' is missing")
        elif not isinstance(value, str):
            result.add_warning(f"Structured schema: 'video_analysis.{field_name}' should be a string, got {type(value).__name__}")
        elif not value.strip():
            result.add_warning(f"Structured schema: 'video_analysis.{field_name}' is empty")
    
    # Check required array fields
    for array_name in ('characters', 'chapters', 'highlights', 'quotes', 'themes'):
        value = video_analysis.get(array_name)
        if value is None:
            result.add_warning(f"Structured schema: 'video_analysis.{array_name}' is missing")
        elif not isinstance(value, list):
            result.add_warning(f"Structured schema: 'video_analysis.{array_name}' should be an array, got {type(value).__name__}")
    
    # Validate character entries
    characters = video_analysis.get('characters')
    if isinstance(characters, list):
        for i, character in enumerate(characters):
            if not isinstance(character, dict):
                result.add_warning(f"Structured schema: 'video_analysis.characters[{i}]' should be an object, got {type(character).__name__}")
                continue
            if 'name' not in character:
                result.add_warning(f"Structured schema: 'video_analysis.characters[{i}]' missing 'name' field")
            if 'is_speaking' not in character:
                result.add_warning(f"Structured schema: 'video_analysis.characters[{i}]' missing 'is_speaking' field")
    
    # Validate chapter entries
    chapters = video_analysis.get('chapters')
    if isinstance(chapters, list):
        for i, chapter in enumerate(chapters):
            if not isinstance(chapter, dict):
                result.add_warning(f"Structured schema: 'video_analysis.chapters[{i}]' should be an object, got {type(chapter).__name__}")
                continue
            for required_field in ('title', 'start_time', 'end_time'):
                if required_field not in chapter:
                    result.add_warning(f"Structured schema: 'video_analysis.chapters[{i}]' missing '{required_field}' field")


def validate_video_output(output_dir: str) -> ValidationResult:
    """
    Validate that video processing output is complete and valid.
    
    Args:
        output_dir: Path to the video's output directory (e.g., output/Video_Name/)
    
    Returns:
        ValidationResult with passed status and any issues found
    """
    result = ValidationResult(passed=True)
    
    analysis_dir = os.path.join(output_dir, 'analysis')
    
    # Check 1: Output directory exists
    if not os.path.exists(output_dir):
        result.add_issue(f"Output directory does not exist: {output_dir}")
        return result
    
    if not os.path.exists(analysis_dir):
        result.add_issue(f"Analysis directory does not exist: {analysis_dir}")
        return result
    
    result.details['output_dir'] = True
    
    # Check 2: Analysis MD exists and has content
    md_path = os.path.join(analysis_dir, 'simple_director_analysis.md')
    if os.path.exists(md_path):
        md_size = os.path.getsize(md_path)
        result.details['analysis_md_bytes'] = md_size
        
        if md_size < 500:
            result.add_issue(f"Analysis MD too small ({md_size} bytes, expected > 500)")
    else:
        result.add_issue("Analysis MD file missing: simple_director_analysis.md")
    
    # Check 3: Analysis JSON is valid and has required fields
    json_path = os.path.join(analysis_dir, 'simple_director_analysis.json')
    if os.path.exists(json_path):
        json_size = os.path.getsize(json_path)
        result.details['analysis_json_bytes'] = json_size
        
        try:
            with open(json_path, 'r') as f:
                data = json.load(f)
            
            # Check for required fields
            if 'video_analysis' not in data:
                result.add_issue("Analysis JSON missing 'video_analysis' field")
            
            if 'processing_metadata' not in data:
                result.add_issue("Analysis JSON missing 'processing_metadata' field")
            
            result.details['json_valid'] = True
            
            # Check 5: Validate new structured JSON schema (warnings only)
            validate_structured_fields(data, result)
            
        except json.JSONDecodeError as e:
            result.add_issue(f"Analysis JSON is invalid: {e}")
            result.details['json_valid'] = False
    else:
        result.add_issue("Analysis JSON file missing: simple_director_analysis.json")
    
    # Check 4: Transcript exists and has content
    transcript_path = os.path.join(analysis_dir, 'full_transcript.txt')
    if os.path.exists(transcript_path):
        transcript_size = os.path.getsize(transcript_path)
        result.details['transcript_bytes'] = transcript_size
        
        if transcript_size < 100:
            # This might be expected for videos with no audio
            result.add_issue(f"Transcript empty or too small ({transcript_size} bytes)")
    else:
        result.add_issue("Transcript file missing: full_transcript.txt")
    
    return result


def check_has_audio(video_path: str) -> bool:
    """
    Check if a video file has an audio track.
    
    Args:
        video_path: Path to the video file
    
    Returns:
        True if video has audio, False otherwise
    """
    import subprocess
    
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'error', '-select_streams', 'a', 
             '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', video_path],
            capture_output=True,
            text=True
        )
        return 'audio' in result.stdout.lower()
    except Exception:
        # If ffprobe fails, assume video has audio
        return True


if __name__ == "__main__":
    # Test validation on existing output
    import sys
    
    if len(sys.argv) > 1:
        output_dir = sys.argv[1]
        result = validate_video_output(output_dir)
        
        print(f"Validation Result: {'PASS' if result.passed else 'FAIL'}")
        print(f"Details: {result.details}")
        
        if result.issues:
            print("Issues:")
            for issue in result.issues:
                print(f"  - {issue}")
        
        if result.warnings:
            print("Warnings (structured schema):")
            for warning in result.warnings:
                print(f"  - {warning}")
    else:
        print("Usage: python validate_output.py <output_directory>")

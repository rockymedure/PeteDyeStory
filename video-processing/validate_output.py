#!/usr/bin/env python3
"""
Video Output Validation Module

Validates that video processing completed successfully by checking:
1. Output directory exists
2. Analysis MD file exists and has content
3. Analysis JSON is valid and has required fields
4. Transcript file exists and has content
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
    details: dict = field(default_factory=dict)
    
    def add_issue(self, issue: str):
        self.issues.append(issue)
        self.passed = False


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
    else:
        print("Usage: python validate_output.py <output_directory>")

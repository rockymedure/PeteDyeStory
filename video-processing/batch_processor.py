#!/usr/bin/env python3
"""
Pete Dye Story - Overnight Batch Video Processor

Processes multiple videos sequentially with:
- Validation after each video
- Retry/recovery on failure
- Automatic highlight clip extraction
- Comprehensive logging

Usage:
    python batch_processor.py
    
    Or run in background:
    nohup python batch_processor.py > batch_output.log 2>&1 &
"""

import asyncio
import sys
import os
import json
import time
import subprocess
from datetime import datetime
from pathlib import Path

# Add scripts folder to path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(SCRIPT_DIR, 'scripts'))

from validate_output import validate_video_output, ValidationResult
from extract_clips import extract_clips_from_analysis

# Load .env file
def load_env():
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


class BatchProcessor:
    def __init__(self):
        self.base_dir = SCRIPT_DIR
        self.videos_dir = os.path.join(os.path.dirname(SCRIPT_DIR), 'videos')
        self.output_dir = os.path.join(SCRIPT_DIR, 'output')
        self.log_file = os.path.join(SCRIPT_DIR, 'batch_log.txt')
        self.summary_file = os.path.join(SCRIPT_DIR, 'batch_summary.md')
        
        self.results = {
            'full_success': [],
            'partial_success': [],
            'total_clips': 0,
            'retries': 0,
            'start_time': None,
            'end_time': None
        }
    
    def log(self, message: str, also_print: bool = True):
        """Log message to file and optionally print"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_entry = f"[{timestamp}] {message}"
        
        with open(self.log_file, 'a') as f:
            f.write(log_entry + '\n')
        
        if also_print:
            print(log_entry)
            sys.stdout.flush()
    
    def load_queue(self) -> list:
        """Load video queue from file"""
        queue_file = os.path.join(SCRIPT_DIR, 'video_queue.txt')
        
        if not os.path.exists(queue_file):
            self.log(f"ERROR: Queue file not found: {queue_file}")
            return []
        
        videos = []
        with open(queue_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    videos.append(line)
        
        return videos
    
    def get_output_dir_name(self, video_filename: str) -> str:
        """Convert video filename to output directory name"""
        # Remove extension and replace special chars
        name = os.path.splitext(video_filename)[0]
        name = name.replace(' ', '_').replace('.', '_').replace('-', '_')
        name = ''.join(c if c.isalnum() or c == '_' else '_' for c in name)
        return name
    
    def process_video(self, video_path: str, segment_duration: int = 150) -> tuple:
        """
        Process a single video using run_video.py
        Returns (success: bool, exit_code: int, error_message: str)
        """
        run_script = os.path.join(SCRIPT_DIR, 'run_video.py')
        
        cmd = [
            sys.executable,
            run_script,
            video_path,
            str(segment_duration)
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=3600  # 1 hour timeout per video
            )
            
            if result.returncode == 0:
                return True, 0, None
            else:
                error_msg = result.stderr or result.stdout or "Unknown error"
                return False, result.returncode, error_msg
                
        except subprocess.TimeoutExpired:
            return False, -1, "Process timeout (exceeded 1 hour)"
        except Exception as e:
            return False, -2, str(e)
    
    def diagnose_and_fix(self, video_path: str, validation: ValidationResult) -> str:
        """
        Attempt to diagnose and fix validation failures
        Returns recovery strategy used
        """
        issues = validation.issues
        
        # Check for rate limit issues
        if any('rate' in issue.lower() for issue in issues):
            self.log("  Detected rate limit issue, waiting 60s...")
            time.sleep(60)
            return "rate_limit_wait"
        
        # Check for empty transcript (no audio)
        if any('transcript' in issue.lower() and 'empty' in issue.lower() for issue in issues):
            self.log("  Empty transcript - video may have no audio, continuing with visual analysis")
            return "no_audio_expected"
        
        # Check for timeout
        if any('timeout' in issue.lower() for issue in issues):
            self.log("  Timeout detected - will retry with longer segments")
            return "retry_longer_segments"
        
        # Default: retry full process
        return "full_retry"
    
    async def process_single_video(self, video_filename: str, index: int, total: int) -> dict:
        """Process a single video with validation and clip extraction"""
        
        video_path = os.path.join(self.videos_dir, video_filename)
        output_name = self.get_output_dir_name(video_filename)
        output_path = os.path.join(self.output_dir, output_name)
        
        result = {
            'video': video_filename,
            'status': 'pending',
            'processing_time': 0,
            'clips_created': 0,
            'issues': [],
            'recovery': None
        }
        
        self.log(f"\n[{index}/{total}] {video_filename}")
        self.log(f"  Started: {datetime.now().strftime('%H:%M:%S')}")
        
        start_time = time.time()
        
        # Check if already processed
        analysis_json = os.path.join(output_path, 'analysis', 'simple_director_analysis.json')
        if os.path.exists(analysis_json):
            self.log(f"  Already processed, skipping to clip extraction...")
            result['status'] = 'already_processed'
        else:
            # Process video
            success, exit_code, error = self.process_video(video_path)
            
            if not success:
                self.log(f"  Processing failed (exit {exit_code}): {error}")
                result['issues'].append(f"Process failed: {error}")
                
                # Retry with longer segments
                self.log(f"  Retrying with 300s segments...")
                self.results['retries'] += 1
                success, exit_code, error = self.process_video(video_path, segment_duration=300)
                
                if not success:
                    self.log(f"  Retry failed: {error}")
                    result['issues'].append(f"Retry failed: {error}")
        
        # Validate output
        if result['status'] != 'already_processed':
            validation = validate_video_output(output_path)
            
            if validation.passed:
                self.log(f"  Validation: PASS")
                result['status'] = 'success'
            else:
                self.log(f"  Validation: PARTIAL ({len(validation.issues)} issues)")
                for issue in validation.issues:
                    self.log(f"    - {issue}")
                    result['issues'].append(issue)
                
                # Attempt recovery
                recovery = self.diagnose_and_fix(video_path, validation)
                result['recovery'] = recovery
                
                if recovery == "full_retry":
                    self.log(f"  Attempting full retry...")
                    self.results['retries'] += 1
                    self.process_video(video_path, segment_duration=300)
                    
                    # Re-validate
                    validation = validate_video_output(output_path)
                    if validation.passed:
                        result['status'] = 'success'
                        result['issues'] = []
                    else:
                        result['status'] = 'partial'
                elif recovery == "no_audio_expected":
                    result['status'] = 'partial'
                else:
                    result['status'] = 'partial'
        else:
            result['status'] = 'success'
        
        # Extract clips (best effort) - up to 10 per video
        self.log(f"  Extracting clips (up to 10)...")
        try:
            clips = extract_clips_from_analysis(video_path, output_path, max_clips=10)
            result['clips_created'] = len(clips)
            self.results['total_clips'] += len(clips)
            
            for clip in clips:
                self.log(f"    - {os.path.basename(clip)}")
            
            self.log(f"  Clips created: {len(clips)}")
        except Exception as e:
            self.log(f"  Clip extraction failed: {e}")
            result['issues'].append(f"Clip extraction failed: {e}")
        
        # Calculate processing time
        result['processing_time'] = time.time() - start_time
        time_str = f"{result['processing_time']/60:.1f}m"
        
        self.log(f"  Total time: {time_str}")
        self.log(f"  STATUS: {result['status'].upper()}")
        
        return result
    
    def write_summary(self):
        """Write final summary report"""
        duration = (self.results['end_time'] - self.results['start_time']).total_seconds()
        hours = int(duration // 3600)
        minutes = int((duration % 3600) // 60)
        
        with open(self.summary_file, 'w') as f:
            f.write("# Batch Processing Summary\n\n")
            f.write(f"Completed: {self.results['end_time'].strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Duration: {hours}h {minutes}m\n\n")
            
            f.write("## Results\n\n")
            f.write(f"- Total: {len(self.results['full_success']) + len(self.results['partial_success'])} videos\n")
            f.write(f"- Full success: {len(self.results['full_success'])}\n")
            f.write(f"- Partial success: {len(self.results['partial_success'])}\n")
            f.write(f"- Retries needed: {self.results['retries']}\n")
            f.write(f"- Total clips extracted: {self.results['total_clips']}\n\n")
            
            if self.results['full_success']:
                f.write("## Full Success\n\n")
                for r in self.results['full_success']:
                    time_str = f"{r['processing_time']/60:.1f}m"
                    f.write(f"- {r['video']} ({time_str}) - {r['clips_created']} clips\n")
                f.write("\n")
            
            if self.results['partial_success']:
                f.write("## Partial Success\n\n")
                for r in self.results['partial_success']:
                    f.write(f"- {r['video']}\n")
                    for issue in r['issues']:
                        f.write(f"  - Issue: {issue}\n")
                    if r['recovery']:
                        f.write(f"  - Recovery: {r['recovery']}\n")
                    f.write(f"  - Clips: {r['clips_created']}\n")
                f.write("\n")
            
            f.write("## Clips Created\n\n")
            f.write(f"All clips saved to output/<video_name>/clips/\n")
            f.write(f"Total: {self.results['total_clips']} clips\n\n")
            
            f.write("## Next Steps\n\n")
            f.write("- Review extracted clips for documentary use\n")
            if self.results['partial_success']:
                f.write("- Check partial success videos for any manual follow-up needed\n")
    
    async def run(self):
        """Run the batch processing"""
        self.results['start_time'] = datetime.now()
        
        # Initialize log
        with open(self.log_file, 'w') as f:
            f.write(f"=== BATCH PROCESSING STARTED: {self.results['start_time'].strftime('%Y-%m-%d %H:%M:%S')} ===\n\n")
        
        self.log("Loading video queue...")
        videos = self.load_queue()
        
        if not videos:
            self.log("ERROR: No videos in queue!")
            return
        
        self.log(f"Found {len(videos)} videos to process\n")
        
        # Process each video
        for i, video in enumerate(videos, 1):
            result = await self.process_single_video(video, i, len(videos))
            
            if result['status'] == 'success' or result['status'] == 'already_processed':
                self.results['full_success'].append(result)
            else:
                self.results['partial_success'].append(result)
        
        # Write summary
        self.results['end_time'] = datetime.now()
        self.write_summary()
        
        self.log(f"\n{'='*50}")
        self.log("BATCH PROCESSING COMPLETE!")
        self.log(f"Full success: {len(self.results['full_success'])}")
        self.log(f"Partial success: {len(self.results['partial_success'])}")
        self.log(f"Total clips: {self.results['total_clips']}")
        self.log(f"Summary saved to: {self.summary_file}")
        self.log(f"{'='*50}")


def main():
    processor = BatchProcessor()
    asyncio.run(processor.run())


if __name__ == "__main__":
    main()

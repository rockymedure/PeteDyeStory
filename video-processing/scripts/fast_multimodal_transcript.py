"""
Fast Multimodal Video Transcriber
Optimized processing engine for video analysis with parallel execution.

Part of the Pete Dye Story video processing system.
Original: Louie project (September 2024)
"""

import cv2
import base64
import json
import requests
from datetime import timedelta
import os
import subprocess
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor
import time


class FastMultimodalVideoTranscriber:
    """
    Optimized video transcriber that combines:
    - OpenAI GPT-4o for audio transcription
    - Grok-4 Vision for visual analysis
    - Parallel processing for speed
    """

    def __init__(self, openai_api_key, grok_api_key):
        self.openai_client = OpenAI(api_key=openai_api_key)
        self.grok_api_key = grok_api_key

    def extract_audio_from_video(self, video_path, output_audio="temp_audio.mp3", save_persistent=False):
        """Extract audio from video file using ffmpeg"""
        print("Extracting audio from video...")

        command = [
            'ffmpeg', '-i', video_path,
            '-acodec', 'mp3',
            '-y',  # Overwrite output file
            output_audio
        ]

        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr}")
            raise Exception(f"Failed to extract audio: {result.stderr}")

        print(f"Audio extracted to {output_audio}")
        return output_audio

    def transcribe_audio_openai(self, audio_path):
        """Transcribe audio using OpenAI's APIs"""
        print("Transcribing audio with OpenAI...")

        with open(audio_path, "rb") as audio_file:
            print("Getting high-quality transcript with gpt-4o-transcribe...")
            high_quality_response = self.openai_client.audio.transcriptions.create(
                model="gpt-4o-transcribe",
                file=audio_file,
                response_format="text",
                prompt="This is golf course construction documentation. The speakers include Pete Dye, construction workers, project managers, and equipment operators discussing golf course design, lake construction, and the building process at Pete Dye Golf Club."
            )

            audio_file.seek(0)

            print("Getting timestamped transcript with whisper-1...")
            timestamped_response = self.openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word"],
                prompt="This is golf course construction documentation featuring Pete Dye and the construction team."
            )

        return {
            'high_quality_transcript': high_quality_response.text if hasattr(high_quality_response, 'text') else str(high_quality_response),
            'timestamped_transcript': timestamped_response.words if hasattr(timestamped_response, 'words') else []
        }

    def extract_frames_with_timestamps(self, video_path, frame_interval=4, output_dir="frames"):
        """Extract frames every N seconds from video and save to disk - OPTIMIZED"""
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        duration = total_frames / fps

        frames_data = []

        print(f"Video duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
        print(f"Extracting frames every {frame_interval} seconds...")

        # Calculate frame positions to extract
        frame_positions = []
        for seconds in range(0, int(duration), frame_interval):
            frame_num = int(seconds * fps)
            if frame_num < total_frames:
                frame_positions.append((frame_num, seconds))

        print(f"Will extract {len(frame_positions)} frames")

        for frame_num, timestamp_seconds in frame_positions:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
            success, frame = cap.read()

            if success:
                # OPTIMIZATION: Smaller frame size (400px instead of 800px)
                height, width = frame.shape[:2]
                if width > 400:
                    scale = 400 / width
                    new_width = int(width * scale)
                    new_height = int(height * scale)
                    frame = cv2.resize(frame, (new_width, new_height))

                # Save frame to disk
                timestamp_str = str(timedelta(seconds=int(timestamp_seconds))).replace(":", "-")
                frame_filename = f"frame_{timestamp_str}_{timestamp_seconds:06.1f}s.jpg"
                frame_path = os.path.join(output_dir, frame_filename)
                cv2.imwrite(frame_path, frame, [cv2.IMWRITE_JPEG_QUALITY, 70])

                # Convert to base64 for API
                _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                frame_b64 = base64.b64encode(buffer).decode('utf-8')

                frames_data.append({
                    'timestamp': str(timedelta(seconds=int(timestamp_seconds))),
                    'seconds': timestamp_seconds,
                    'frame_data': frame_b64,
                    'filename': frame_filename,
                    'filepath': frame_path
                })

                print(f"Extracted and saved frame at {str(timedelta(seconds=int(timestamp_seconds)))} -> {frame_filename}")

        cap.release()
        return frames_data

    def sync_audio_video_data(self, frames_data, audio_transcript):
        """Synchronize audio transcript with video frames"""
        print("Synchronizing audio and video data...")

        synchronized_data = []
        words = audio_transcript['timestamped_transcript'] if isinstance(audio_transcript['timestamped_transcript'], list) else []

        for frame in frames_data:
            frame_start_time = frame['seconds']
            frame_end_time = frame_start_time + 4  # 4-second frame interval

            # Find audio segments within this frame's time window
            frame_audio_words = []
            frame_audio_text = ""

            for word in words:
                word_start = getattr(word, 'start', word.get('start', 0) if isinstance(word, dict) else 0)
                word_end = getattr(word, 'end', word.get('end', 0) if isinstance(word, dict) else 0)
                word_text = getattr(word, 'word', word.get('word', '') if isinstance(word, dict) else '')

                if (word_start <= frame_end_time and word_end >= frame_start_time):
                    frame_audio_words.append({
                        'word': word_text,
                        'start': word_start,
                        'end': word_end
                    })
                    frame_audio_text += word_text + " "

            synchronized_data.append({
                'timestamp': frame['timestamp'],
                'seconds': frame['seconds'],
                'frame_data': frame['frame_data'],
                'filename': frame['filename'],
                'audio_words': frame_audio_words,
                'audio_text': frame_audio_text.strip(),
                'has_speech': len(frame_audio_words) > 0
            })

        return synchronized_data

    def send_batch_to_grok(self, batch_data, batch_num, high_quality_transcript):
        """Send a batch of frames to Grok 4 for analysis"""
        print(f"Processing batch {batch_num} ({len(batch_data)} frames)...")

        content = [{
            "type": "text",
            "text": f"""Analyze this video segment with synchronized audio transcription.

FULL AUDIO TRANSCRIPT (High Quality):
{high_quality_transcript}

FRAME-BY-FRAME ANALYSIS FOR BATCH {batch_num}:
Below are video frames from this segment, each paired with actual spoken words during that time.

For each frame, create a timeline entry with:
1. **Visual Scene**: What's happening visually
2. **Spoken Words**: Actual dialogue/speech from audio
3. **Speaker Context**: Who appears to be speaking
4. **Cross-Modal Analysis**: How visual and audio relate
5. **Narrative Flow**: How this fits the overall story

Format: [HH:MM:SS] **VISUAL**: [scene] | **AUDIO**: "[words]" | **CONTEXT**: [analysis]"""
        }]

        for data in batch_data:
            speech_indicator = "🎤 SPEECH" if data['has_speech'] else "🔇 NO SPEECH"

            content.append({
                "type": "text",
                "text": f"""\n=== FRAME AT {data['timestamp']} ===
{speech_indicator}
AUDIO TEXT: "{data['audio_text']}"
SAVED AS: {data['filename']}"""
            })

            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{data['frame_data']}"
                }
            })

        payload = {
            "messages": [{"role": "user", "content": content}],
            "model": "grok-4-latest",
            "stream": False,
            "temperature": 0.1
        }

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.grok_api_key}"
        }

        response = requests.post("https://api.x.ai/v1/chat/completions",
                               headers=headers,
                               json=payload)

        if response.status_code == 200:
            result = response.json()
            return {
                'batch_num': batch_num,
                'content': result['choices'][0]['message']['content']
            }
        else:
            print(f"Error in batch {batch_num}: {response.status_code} - {response.text}")
            return None

    def send_multimodal_analysis_to_grok_batched(self, synchronized_data, high_quality_transcript):
        """OPTIMIZATION: Send frames in batches for parallel processing"""
        print("Preparing batched multimodal analysis...")

        # Split into batches of 30 frames each
        batch_size = 30
        batches = [synchronized_data[i:i+batch_size] for i in range(0, len(synchronized_data), batch_size)]

        print(f"Processing {len(batches)} batches in parallel...")

        # Process batches in parallel
        batch_results = []
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = []
            for i, batch in enumerate(batches):
                future = executor.submit(self.send_batch_to_grok, batch, i+1, high_quality_transcript)
                futures.append(future)

            # Collect results as they complete
            for future in futures:
                result = future.result()
                if result:
                    batch_results.append(result)

        # Combine batch results
        combined_analysis = "\n\n".join([
            f"=== BATCH {result['batch_num']} ANALYSIS ===\n{result['content']}"
            for result in sorted(batch_results, key=lambda x: x['batch_num'])
        ])

        return combined_analysis

    def process_video_fast(self, video_path, frame_interval=4):
        """OPTIMIZED: Main processing pipeline with parallel execution"""
        print(f"Fast processing video: {video_path}")
        start_time = time.time()

        # OPTIMIZATION 1: Parallel audio and video extraction
        print("Starting parallel audio and video extraction...")

        with ThreadPoolExecutor(max_workers=2) as executor:
            # Create unique audio filename for each segment to avoid overwriting
            video_basename = os.path.splitext(os.path.basename(video_path))[0]
            unique_audio_path = f"temp_audio_{video_basename}.mp3"
            audio_future = executor.submit(self.extract_audio_from_video, video_path, unique_audio_path)
            frames_future = executor.submit(self.extract_frames_with_timestamps, video_path, frame_interval)

            # Both happen simultaneously
            audio_path = audio_future.result()
            frames_data = frames_future.result()

        extraction_time = time.time() - start_time
        print(f"Extraction completed in {extraction_time:.1f} seconds")

        # Audio transcription
        transcription_start = time.time()
        audio_transcript = self.transcribe_audio_openai(audio_path)
        transcription_time = time.time() - transcription_start
        print(f"Audio transcription completed in {transcription_time:.1f} seconds")

        # Synchronization
        synchronized_data = self.sync_audio_video_data(frames_data, audio_transcript)

        # OPTIMIZATION: Batched analysis
        analysis_start = time.time()
        multimodal_analysis = self.send_multimodal_analysis_to_grok_batched(
            synchronized_data,
            audio_transcript['high_quality_transcript']
        )
        analysis_time = time.time() - analysis_start
        print(f"Video analysis completed in {analysis_time:.1f} seconds")

        # Cleanup temp audio
        if os.path.exists(audio_path) and "temp_audio" in audio_path:
            os.remove(audio_path)

        total_time = time.time() - start_time
        print(f"\n✅ Fast processing completed in {total_time:.1f} seconds!")

        return {
            'processing_time': total_time,
            'frames_count': len(frames_data),
            'multimodal_analysis': multimodal_analysis,
            'audio_transcript': audio_transcript['high_quality_transcript'],
            'optimization_summary': {
                'extraction_time': extraction_time,
                'transcription_time': transcription_time,
                'analysis_time': analysis_time
            }
        }

    def process_video_visual_only(self, video_path, frame_interval=4, full_transcript=None):
        """
        Process video with VISUAL analysis only, using provided full transcript for audio context.
        This eliminates audio extraction/transcription per segment.
        """
        start_time = time.time()
        print(f"Visual-only processing video: {video_path}")

        # Extract frames for visual analysis
        print("Extracting frames for visual analysis...")
        frames_data = self.extract_frames_with_timestamps(video_path, frame_interval)
        print(f"Extracted {len(frames_data)} frames")

        if not frames_data:
            return {'error': 'No frames extracted', 'processing_time': time.time() - start_time}

        # Use visual analysis with full transcript context
        multimodal_analysis = self.create_multimodal_analysis_with_transcript(
            frames_data, full_transcript
        )

        total_time = time.time() - start_time
        print(f"✅ Visual processing completed in {total_time:.1f} seconds!")

        return {
            'processing_time': total_time,
            'frames_count': len(frames_data),
            'multimodal_analysis': multimodal_analysis,
            'audio_transcript': full_transcript,
            'success': True
        }

    def create_multimodal_analysis_with_transcript(self, frames_data, full_transcript):
        """Create multimodal analysis using frames and provided full transcript"""
        high_quality_text = full_transcript.get('high_quality_transcript', '') if full_transcript else ''

        # Process frames in batches
        batch_size = 30
        all_analyses = []

        for i in range(0, len(frames_data), batch_size):
            batch = frames_data[i:i + batch_size]
            batch_num = i // batch_size + 1

            analysis = self.process_frames_batch_with_transcript(batch, batch_num, high_quality_text)
            if analysis:
                all_analyses.append(analysis)

        return '\n\n'.join(all_analyses) if all_analyses else "No visual analysis available"

    def process_frames_batch_with_transcript(self, batch_data, batch_num, full_transcript_text):
        """Process a batch of frames with full transcript context"""
        messages = [{
            "role": "user",
            "content": [{
                "type": "text",
                "text": f"""Analyze this video segment with complete audio transcript context.

COMPLETE AUDIO TRANSCRIPT:
{full_transcript_text[:1500]}...

VISUAL ANALYSIS FOR BATCH {batch_num}:
Analyze the frames below in context of the complete audio transcript.

For each frame, create entries with:
1. **Visual Scene**: What's happening visually
2. **Audio Context**: Relevant spoken words from transcript that match this timeframe
3. **Speaker Analysis**: Who appears to be speaking based on visual cues
4. **Cross-Modal Sync**: How visual and audio elements relate
5. **Narrative Flow**: How this fits the overall story

Format: [HH:MM:SS] **VISUAL**: [scene] | **AUDIO**: "[words]" | **CONTEXT**: [analysis]"""
            }]
        }]

        # Add frame data
        for data in batch_data:
            messages[0]["content"].append({
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{data['frame_data']}"}
            })
            messages[0]["content"].append({
                "type": "text",
                "text": f"Frame at {data['timestamp']} ({data['seconds']:.1f}s)"
            })

        # Call Grok API
        try:
            response = requests.post(
                "https://api.x.ai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.grok_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "messages": messages,
                    "model": "grok-4-latest",
                    "temperature": 0.1,
                    "max_tokens": 4000
                },
                timeout=120
            )

            if response.status_code == 200:
                return response.json()['choices'][0]['message']['content']
            else:
                print(f"Error in batch {batch_num}: {response.status_code} - {response.text}")
                return None

        except Exception as e:
            print(f"Exception in batch {batch_num}: {e}")
            return None


def main():
    """Test the fast multimodal transcriber"""
    openai_api_key = os.environ.get('OPENAI_API_KEY')
    grok_api_key = os.environ.get('GROK_API_KEY')

    if not openai_api_key or not grok_api_key:
        print("Error: Please set OPENAI_API_KEY and GROK_API_KEY environment variables")
        return

    transcriber = FastMultimodalVideoTranscriber(openai_api_key, grok_api_key)

    # Test with a video file
    video_path = "../test/test_video.mp4"

    if os.path.exists(video_path):
        print("🚀 RUNNING OPTIMIZED MULTIMODAL PROCESSING")
        print("-" * 70)
        results = transcriber.process_video_fast(video_path, frame_interval=4)
        print(f"\n🎯 Total processing time: {results['processing_time']:.1f} seconds")
    else:
        print(f"Test video not found: {video_path}")


if __name__ == "__main__":
    main()

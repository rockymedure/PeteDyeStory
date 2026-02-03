"""
Fast Multimodal Video Transcriber
Optimized processing engine for video analysis with parallel execution.
Uses OpenAI for both audio transcription AND visual analysis.

Part of the Pete Dye Story video processing system.
"""

import cv2
import base64
import json
from datetime import timedelta
import os
import subprocess
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor
import time


class FastMultimodalVideoTranscriber:
    """
    Optimized video transcriber that uses OpenAI for everything:
    - GPT-4o-transcribe for audio transcription
    - GPT-4o (vision) for visual analysis
    - Parallel processing for speed
    """

    def __init__(self, openai_api_key):
        self.openai_client = OpenAI(api_key=openai_api_key)

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
        """Transcribe audio using OpenAI's APIs, with chunking for large files"""
        print("Transcribing audio with OpenAI...")
        
        # Check file size - OpenAI has 25MB limit
        file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
        print(f"Audio file size: {file_size_mb:.1f} MB")
        
        if file_size_mb > 24:
            print(f"Audio file too large ({file_size_mb:.1f} MB), splitting into chunks...")
            return self.transcribe_large_audio(audio_path)
        
        with open(audio_path, "rb") as audio_file:
            print("Getting high-quality transcript with gpt-4o-transcribe...")
            high_quality_response = self.openai_client.audio.transcriptions.create(
                model="gpt-4o-transcribe",
                file=audio_file,
                response_format="text",
                prompt="This is archival footage from the Pete Dye Golf Club story (1978-2004). Content may include: construction footage, family gatherings, interviews, celebrations, award ceremonies, tournaments, or social events. Speakers may include Pete Dye, the LaRosa family, friends, dignitaries, or professional golfers. Transcribe accurately based on what you hear."
            )

            audio_file.seek(0)

            print("Getting timestamped transcript with whisper-1...")
            timestamped_response = self.openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["word"],
                prompt="Archival footage from Pete Dye Golf Club including construction, interviews, celebrations, family events, and tournaments."
            )

        return {
            'high_quality_transcript': high_quality_response.text if hasattr(high_quality_response, 'text') else str(high_quality_response),
            'timestamped_transcript': timestamped_response.words if hasattr(timestamped_response, 'words') else []
        }

    def transcribe_large_audio(self, audio_path):
        """Transcribe large audio files by splitting into chunks"""
        import subprocess
        import tempfile
        import shutil
        
        # Get audio duration
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audio_path],
            capture_output=True, text=True
        )
        total_duration = float(result.stdout.strip())
        print(f"Total audio duration: {total_duration/60:.1f} minutes")
        
        # Split into 10-minute chunks (should be under 25MB each)
        chunk_duration = 600  # 10 minutes
        chunk_dir = tempfile.mkdtemp(prefix="audio_chunks_")
        
        try:
            chunks = []
            start_time = 0
            chunk_num = 0
            
            while start_time < total_duration:
                chunk_path = os.path.join(chunk_dir, f"chunk_{chunk_num:03d}.mp3")
                duration = min(chunk_duration, total_duration - start_time)
                
                # Extract chunk with ffmpeg
                subprocess.run([
                    'ffmpeg', '-i', audio_path,
                    '-ss', str(start_time),
                    '-t', str(duration),
                    '-acodec', 'mp3', '-ab', '64k',  # Lower bitrate to reduce size
                    '-y', chunk_path
                ], capture_output=True, text=True)
                
                chunks.append({
                    'path': chunk_path,
                    'start_time': start_time,
                    'duration': duration
                })
                
                print(f"  Created chunk {chunk_num}: {start_time/60:.1f} - {(start_time + duration)/60:.1f} min")
                start_time += chunk_duration
                chunk_num += 1
            
            print(f"Split into {len(chunks)} chunks, now transcribing...")
            
            # Transcribe each chunk
            all_transcripts = []
            all_words = []
            
            for i, chunk in enumerate(chunks):
                print(f"  Transcribing chunk {i+1}/{len(chunks)}...")
                
                with open(chunk['path'], 'rb') as audio_file:
                    # High-quality transcript
                    response = self.openai_client.audio.transcriptions.create(
                        model="gpt-4o-transcribe",
                        file=audio_file,
                        response_format="text",
                        prompt="Archival footage from Pete Dye Golf Club story (1978-2004). May include construction, interviews, celebrations, family events, or tournaments."
                    )
                    
                    transcript_text = response.text if hasattr(response, 'text') else str(response)
                    all_transcripts.append(transcript_text)
                    
                    # Get timestamped version too
                    audio_file.seek(0)
                    timestamped = self.openai_client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="verbose_json",
                        timestamp_granularities=["word"],
                        prompt="Pete Dye Golf Club archival footage including construction, celebrations, interviews, and events."
                    )
                    
                    # Adjust timestamps for chunk offset
                    if hasattr(timestamped, 'words'):
                        for word in timestamped.words:
                            adjusted_word = {
                                'word': getattr(word, 'word', ''),
                                'start': getattr(word, 'start', 0) + chunk['start_time'],
                                'end': getattr(word, 'end', 0) + chunk['start_time']
                            }
                            all_words.append(adjusted_word)
            
            # Combine all transcripts
            full_transcript = '\n\n'.join(all_transcripts)
            print(f"✅ Transcription complete: {len(full_transcript)} characters")
            
            return {
                'high_quality_transcript': full_transcript,
                'timestamped_transcript': all_words
            }
            
        finally:
            # Cleanup chunk files
            shutil.rmtree(chunk_dir, ignore_errors=True)

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

    def send_batch_to_openai_vision(self, batch_data, batch_num, high_quality_transcript):
        """Send a batch of frames to OpenAI GPT-4o Vision for analysis"""
        print(f"Processing batch {batch_num} ({len(batch_data)} frames) with GPT-4o Vision...")

        # Build the message content with text and images
        content = [{
            "type": "text",
            "text": f"""Analyze this video segment with synchronized audio transcription.

FULL AUDIO TRANSCRIPT (High Quality):
{high_quality_transcript[:3000]}

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
                "text": f"\n=== FRAME AT {data['timestamp']} ===\n{speech_indicator}\nAUDIO TEXT: \"{data['audio_text']}\""
            })

            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{data['frame_data']}",
                    "detail": "low"  # Use low detail for faster processing
                }
            })

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": content}],
                max_tokens=4000,
                temperature=0.1
            )

            return {
                'batch_num': batch_num,
                'content': response.choices[0].message.content
            }
        except Exception as e:
            print(f"Error in batch {batch_num}: {e}")
            return None

    def send_multimodal_analysis_batched(self, synchronized_data, high_quality_transcript):
        """Send frames in batches for parallel processing using OpenAI Vision"""
        print("Preparing batched multimodal analysis with GPT-4o Vision...")

        # Split into batches of 20 frames each (smaller batches for OpenAI)
        batch_size = 20
        batches = [synchronized_data[i:i+batch_size] for i in range(0, len(synchronized_data), batch_size)]

        print(f"Processing {len(batches)} batches...")

        # Process batches (can be parallelized but being careful with rate limits)
        batch_results = []
        for i, batch in enumerate(batches):
            result = self.send_batch_to_openai_vision(batch, i+1, high_quality_transcript)
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

        # Parallel audio and video extraction
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

        # Batched visual analysis with OpenAI
        analysis_start = time.time()
        multimodal_analysis = self.send_multimodal_analysis_batched(
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
        batch_size = 20
        all_analyses = []

        for i in range(0, len(frames_data), batch_size):
            batch = frames_data[i:i + batch_size]
            batch_num = i // batch_size + 1

            analysis = self.process_frames_batch_with_transcript(batch, batch_num, high_quality_text)
            if analysis:
                all_analyses.append(analysis)

        return '\n\n'.join(all_analyses) if all_analyses else "No visual analysis available"

    def process_frames_batch_with_transcript(self, batch_data, batch_num, full_transcript_text):
        """Process a batch of frames with full transcript context using OpenAI Vision"""
        content = [{
            "type": "text",
            "text": f"""Analyze this video segment with complete audio transcript context.

COMPLETE AUDIO TRANSCRIPT:
{full_transcript_text[:2000]}...

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

        # Add frame data
        for data in batch_data:
            content.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{data['frame_data']}",
                    "detail": "low"
                }
            })
            content.append({
                "type": "text",
                "text": f"Frame at {data['timestamp']} ({data['seconds']:.1f}s)"
            })

        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": content}],
                max_tokens=4000,
                temperature=0.1
            )

            return response.choices[0].message.content
        except Exception as e:
            print(f"Exception in batch {batch_num}: {e}")
            return None


def main():
    """Test the fast multimodal transcriber"""
    openai_api_key = os.environ.get('OPENAI_API_KEY')

    if not openai_api_key:
        print("Error: Please set OPENAI_API_KEY environment variable")
        return

    transcriber = FastMultimodalVideoTranscriber(openai_api_key)

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

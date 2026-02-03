#!/bin/bash
# Process all clips: optimize for web and generate thumbnails
# With retry logic and fallback encoding

CLIPS_DIR="/Users/rockymedure/Desktop/PeteDyeStory/video-processing/output"
OUTPUT_DIR="/Users/rockymedure/Desktop/PeteDyeStory/web-clips"
THUMBS_DIR="/Users/rockymedure/Desktop/PeteDyeStory/web-clips/thumbnails"
LOG_FILE="/Users/rockymedure/Desktop/PeteDyeStory/scripts/encode-errors.log"

# Create output directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$THUMBS_DIR"

# Clear error log
> "$LOG_FILE"

# Count total clips
total=$(find "$CLIPS_DIR" -name "*.mp4" -path "*/clips/*" | wc -l | tr -d ' ')
current=0
success=0
failed=0

echo "Processing $total clips..."
echo ""

encode_clip() {
  local input="$1"
  local output="$2"
  
  # Try 1: Standard H.264 encoding
  if ffmpeg -y -i "$input" \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    "$output" 2>/dev/null; then
    return 0
  fi
  
  # Try 2: Higher CRF (smaller, lower quality)
  if ffmpeg -y -i "$input" \
    -c:v libx264 -preset fast -crf 28 \
    -c:a aac -b:a 96k \
    -movflags +faststart \
    "$output" 2>/dev/null; then
    return 0
  fi
  
  # Try 3: Copy video stream, just remux
  if ffmpeg -y -i "$input" \
    -c:v copy -c:a aac -b:a 128k \
    -movflags +faststart \
    "$output" 2>/dev/null; then
    return 0
  fi
  
  # Try 4: Force pixel format
  if ffmpeg -y -i "$input" \
    -c:v libx264 -preset fast -crf 28 \
    -pix_fmt yuv420p \
    -c:a aac -b:a 96k \
    -movflags +faststart \
    "$output" 2>/dev/null; then
    return 0
  fi
  
  return 1
}

generate_thumbnail() {
  local input="$1"
  local output="$2"
  
  # Try at 2 seconds
  if ffmpeg -y -i "$input" -ss 00:00:02 -vframes 1 -vf "scale=320:-1" "$output" 2>/dev/null; then
    return 0
  fi
  
  # Try at 1 second
  if ffmpeg -y -i "$input" -ss 00:00:01 -vframes 1 -vf "scale=320:-1" "$output" 2>/dev/null; then
    return 0
  fi
  
  # Try first frame
  if ffmpeg -y -i "$input" -vframes 1 -vf "scale=320:-1" "$output" 2>/dev/null; then
    return 0
  fi
  
  return 1
}

# Process clips
while IFS= read -r clip; do
  current=$((current + 1))
  
  # Extract video name and clip name from path
  video_dir=$(dirname "$(dirname "$clip")")
  video_name=$(basename "$video_dir")
  clip_name=$(basename "$clip" .mp4)
  
  # Create safe filename
  safe_name="${video_name}__${clip_name}"
  output_file="$OUTPUT_DIR/${safe_name}.mp4"
  thumb_file="$THUMBS_DIR/${safe_name}.jpg"
  
  # Skip if already fully processed
  if [ -f "$output_file" ] && [ -f "$thumb_file" ]; then
    echo "[$current/$total] OK $video_name / $clip_name"
    success=$((success + 1))
    continue
  fi
  
  echo "[$current/$total] $video_name / $clip_name"
  
  # Encode video if needed
  if [ ! -f "$output_file" ]; then
    if encode_clip "$clip" "$output_file"; then
      echo "   Encoded"
    else
      echo "   FAILED to encode" | tee -a "$LOG_FILE"
      echo "   Source: $clip" >> "$LOG_FILE"
      failed=$((failed + 1))
      continue
    fi
  fi
  
  # Generate thumbnail if needed
  if [ ! -f "$thumb_file" ]; then
    if generate_thumbnail "$output_file" "$thumb_file"; then
      echo "   Thumbnail OK"
    else
      # Try from source
      if generate_thumbnail "$clip" "$thumb_file"; then
        echo "   Thumbnail from source"
      else
        echo "   FAILED thumbnail" | tee -a "$LOG_FILE"
      fi
    fi
  fi
  
  success=$((success + 1))
  
done < <(find "$CLIPS_DIR" -name "*.mp4" -path "*/clips/*" | sort)

echo ""
echo "Done!"
echo "Success: $success, Failed: $failed"

# Show stats
optimized_count=$(find "$OUTPUT_DIR" -maxdepth 1 -name "*.mp4" 2>/dev/null | wc -l | tr -d ' ')
thumb_count=$(find "$THUMBS_DIR" -name "*.jpg" 2>/dev/null | wc -l | tr -d ' ')
total_size=$(du -sh "$OUTPUT_DIR" 2>/dev/null | cut -f1)

echo "Optimized: $optimized_count clips, Thumbnails: $thumb_count, Size: $total_size"

if [ -s "$LOG_FILE" ]; then
  echo ""
  echo "Errors logged to: $LOG_FILE"
fi

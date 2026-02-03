#!/bin/bash
# Process all clips: optimize for web and generate thumbnails

CLIPS_DIR="/Users/rockymedure/Desktop/PeteDyeStory/video-processing/output"
OUTPUT_DIR="/Users/rockymedure/Desktop/PeteDyeStory/web-clips"
THUMBS_DIR="/Users/rockymedure/Desktop/PeteDyeStory/web-clips/thumbnails"

# Create output directories
mkdir -p "$OUTPUT_DIR"
mkdir -p "$THUMBS_DIR"

# Count total clips
total=$(find "$CLIPS_DIR" -name "*.mp4" -path "*/clips/*" | wc -l | tr -d ' ')
current=0

echo "🎬 Processing $total clips..."
echo ""

# Process clips using process substitution
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
  
  # Skip if already processed
  if [ -f "$output_file" ] && [ -f "$thumb_file" ]; then
    echo "[$current/$total] ✓ $clip_name"
    continue
  fi
  
  echo "[$current/$total] $video_name / $clip_name"
  
  # Optimize video for web (H.264, AAC, faststart)
  if [ ! -f "$output_file" ]; then
    ffmpeg -i "$clip" \
      -c:v libx264 -preset fast -crf 23 \
      -c:a aac -b:a 128k \
      -movflags +faststart \
      -y "$output_file" 2>/dev/null
    
    if [ $? -ne 0 ]; then
      echo "   ⚠️ Encode error"
      continue
    fi
  fi
  
  # Generate thumbnail
  if [ ! -f "$thumb_file" ]; then
    ffmpeg -i "$output_file" \
      -ss 00:00:02 \
      -vframes 1 \
      -vf "scale=320:-1" \
      -y "$thumb_file" 2>/dev/null || \
    ffmpeg -i "$output_file" \
      -vframes 1 \
      -vf "scale=320:-1" \
      -y "$thumb_file" 2>/dev/null
  fi
done < <(find "$CLIPS_DIR" -name "*.mp4" -path "*/clips/*" | sort)

echo ""
echo "✅ Done!"

# Show stats
optimized_count=$(find "$OUTPUT_DIR" -maxdepth 1 -name "*.mp4" 2>/dev/null | wc -l | tr -d ' ')
thumb_count=$(find "$THUMBS_DIR" -name "*.jpg" 2>/dev/null | wc -l | tr -d ' ')
total_size=$(du -sh "$OUTPUT_DIR" 2>/dev/null | cut -f1)

echo "📊 Optimized: $optimized_count clips, Thumbnails: $thumb_count, Size: $total_size"

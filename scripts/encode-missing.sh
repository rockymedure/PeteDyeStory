#!/bin/bash
# Encode all missing clips with aggressive retry

OUTPUT_DIR="/Users/rockymedure/Desktop/PeteDyeStory/web-clips"
THUMBS_DIR="/Users/rockymedure/Desktop/PeteDyeStory/web-clips/thumbnails"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$THUMBS_DIR"

encode_clip() {
  local input="$1"
  local output="$2"
  
  # Try standard H.264
  if ffmpeg -y -i "$input" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart "$output" 2>/dev/null; then
    return 0
  fi
  
  # Try with pixel format fix
  if ffmpeg -y -i "$input" -c:v libx264 -preset fast -crf 28 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart "$output" 2>/dev/null; then
    return 0
  fi
  
  # Try copy
  if ffmpeg -y -i "$input" -c:v copy -c:a aac -b:a 128k -movflags +faststart "$output" 2>/dev/null; then
    return 0
  fi
  
  # Try no audio
  if ffmpeg -y -i "$input" -c:v libx264 -preset fast -crf 28 -an -movflags +faststart "$output" 2>/dev/null; then
    return 0
  fi
  
  return 1
}

total=0
success=0
failed=0

# Find all missing clips
while IFS= read -r clip; do
  video_dir=$(dirname "$(dirname "$clip")")
  video_name=$(basename "$video_dir")
  clip_name=$(basename "$clip" .mp4)
  safe_name="${video_name}__${clip_name}"
  output_file="$OUTPUT_DIR/${safe_name}.mp4"
  thumb_file="$THUMBS_DIR/${safe_name}.jpg"
  
  # Skip if already exists
  if [ -f "$output_file" ]; then
    continue
  fi
  
  total=$((total + 1))
  echo "[$total] $video_name / $clip_name"
  
  # Encode
  if encode_clip "$clip" "$output_file"; then
    echo "   OK"
    success=$((success + 1))
    
    # Generate thumbnail
    if [ ! -f "$thumb_file" ]; then
      ffmpeg -y -i "$output_file" -ss 00:00:02 -vframes 1 -vf "scale=320:-1" "$thumb_file" 2>/dev/null || \
      ffmpeg -y -i "$output_file" -vframes 1 -vf "scale=320:-1" "$thumb_file" 2>/dev/null || \
      ffmpeg -y -i "$clip" -vframes 1 -vf "scale=320:-1" "$thumb_file" 2>/dev/null
    fi
  else
    echo "   FAILED"
    failed=$((failed + 1))
  fi
  
done < <(find /Users/rockymedure/Desktop/PeteDyeStory/video-processing/output -name "*.mp4" -path "*/clips/*" 2>/dev/null | sort)

echo ""
echo "Done! Success: $success, Failed: $failed"
echo "Total clips: $(ls -1 $OUTPUT_DIR/*.mp4 2>/dev/null | wc -l | tr -d ' ')"
echo "Total thumbnails: $(ls -1 $THUMBS_DIR/*.jpg 2>/dev/null | wc -l | tr -d ' ')"

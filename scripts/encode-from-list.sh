#!/bin/bash
# Encode clips from a list file

OUTPUT_DIR="/Users/rockymedure/Desktop/PeteDyeStory/web-clips"
THUMBS_DIR="/Users/rockymedure/Desktop/PeteDyeStory/web-clips/thumbnails"

total=$(wc -l < /tmp/missing_clips.txt)
count=0
success=0

while IFS= read -r clip; do
  count=$((count + 1))
  
  video_dir=$(dirname "$(dirname "$clip")")
  video_name=$(basename "$video_dir")
  clip_name=$(basename "$clip" .mp4)
  safe_name="${video_name}__${clip_name}"
  output="$OUTPUT_DIR/${safe_name}.mp4"
  thumb="$THUMBS_DIR/${safe_name}.jpg"
  
  # Skip if exists
  if [ -f "$output" ]; then
    echo "[$count/$total] SKIP: already exists"
    continue
  fi
  
  echo "[$count/$total] Encoding: $video_name / $clip_name"
  
  # Encode
  ffmpeg -y -i "$clip" \
    -c:v libx264 -preset fast -crf 23 \
    -c:a aac -b:a 128k \
    -movflags +faststart \
    "$output" 2>/dev/null
  
  # Check result
  if [ -f "$output" ] && [ -s "$output" ]; then
    echo "         -> SUCCESS"
    success=$((success + 1))
    
    # Thumbnail
    if [ ! -f "$thumb" ]; then
      ffmpeg -y -i "$output" -ss 2 -vframes 1 -vf "scale=320:-1" "$thumb" 2>/dev/null || \
      ffmpeg -y -i "$output" -vframes 1 -vf "scale=320:-1" "$thumb" 2>/dev/null
    fi
  else
    echo "         -> FAILED"
  fi
  
done < /tmp/missing_clips.txt

echo ""
echo "Complete! Success: $success / $total"
echo "Total clips: $(ls -1 $OUTPUT_DIR/*.mp4 | wc -l)"
echo "Total thumbnails: $(ls -1 $THUMBS_DIR/*.jpg | wc -l)"

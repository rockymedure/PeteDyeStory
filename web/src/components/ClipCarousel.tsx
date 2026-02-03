'use client';

import { useState, useRef } from 'react';
import type { Clip } from '@/lib/types';

interface ClipWithVideo extends Clip {
  video?: { filename: string };
}

interface ClipCarouselProps {
  clips: ClipWithVideo[];
}

function getThumbnailPath(clip: ClipWithVideo): string {
  if (clip.thumbnail_path) return clip.thumbnail_path;
  const videoFilename = (clip.video?.filename || '').replace(/-/g, '_');
  const clipName = clip.filename?.replace('.mp4', '') || '';
  return `/thumbnails/${videoFilename}__${clipName}.jpg`;
}

function getClipPath(clip: ClipWithVideo): string {
  if (clip.storage_path) return clip.storage_path;
  // Clips are stored flat: {video_name}__{clip_name}.mp4
  const videoFilename = (clip.video?.filename || '').replace(/-/g, '_');
  const clipName = clip.filename?.replace('.mp4', '') || '';
  return `/clips/${videoFilename}__${clipName}.mp4`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function ClipCarousel({ clips }: ClipCarouselProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const handlePlay = (clip: ClipWithVideo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingId === clip.id) {
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setPlayingId(null);
    } else {
      setPlayingId(clip.id);
    }
  };

  const handleVideoEnd = () => {
    setPlayingId(null);
  };

  const displayClips = clips.slice(0, 6);
  const remaining = clips.length - 6;

  return (
    <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
      {displayClips.map((clip) => {
        const isPlaying = playingId === clip.id;
        const thumbPath = getThumbnailPath(clip);
        const clipPath = getClipPath(clip);
        
        return (
          <div
            key={clip.id}
            onClick={(e) => handlePlay(clip, e)}
            className="clip-thumb flex-shrink-0 w-36 md:w-44 cursor-pointer group"
          >
            {isPlaying ? (
              <video
                ref={videoRef}
                src={clipPath}
                autoPlay
                controls
                onEnded={handleVideoEnd}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-full object-cover rounded-md"
              />
            ) : (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbPath}
                  alt={clip.description || clip.filename || 'Clip'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                
                {/* Play overlay - uses CSS hover via group-hover */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-4 h-4 text-black ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
                
                {/* Duration badge */}
                {clip.duration_seconds && (
                  <span className="absolute bottom-1.5 right-1.5 font-mono text-[10px] text-white bg-black/70 px-1.5 py-0.5 rounded z-10">
                    {formatDuration(clip.duration_seconds)}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}
      
      {remaining > 0 && (
        <div className="flex-shrink-0 w-36 md:w-44 aspect-video bg-[var(--bg-elevated)] rounded-md flex flex-col items-center justify-center border border-dashed border-[var(--border-subtle)]">
          <span className="font-mono text-lg text-[var(--text-muted)]">+{remaining}</span>
          <span className="font-mono text-[9px] text-[var(--text-muted)] uppercase tracking-wider mt-1">more</span>
        </div>
      )}
    </div>
  );
}

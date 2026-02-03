'use client';

import { useState } from 'react';
import type { Clip } from '@/lib/types';
import VideoPlayer from './VideoPlayer';

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

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export default function ClipCarousel({ clips }: ClipCarouselProps) {
  const [playerOpen, setPlayerOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleOpenPlayer = (index: number) => {
    setCurrentIndex(index);
    setPlayerOpen(true);
  };

  const handleClosePlayer = () => {
    setPlayerOpen(false);
  };

  const handleNavigate = (index: number) => {
    setCurrentIndex(index);
  };

  const displayClips = clips.slice(0, 6);
  const remaining = clips.length - 6;

  return (
    <>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-1">
        {displayClips.map((clip, index) => {
          const thumbPath = getThumbnailPath(clip);
          
          return (
            <div
              key={clip.id}
              onClick={() => handleOpenPlayer(index)}
              className="clip-thumb flex-shrink-0 w-36 md:w-44 cursor-pointer group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbPath}
                alt={clip.description || clip.filename || 'Clip'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              
              {/* Play overlay */}
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
            </div>
          );
        })}
        
        {remaining > 0 && (
          <div 
            onClick={() => handleOpenPlayer(6)}
            className="flex-shrink-0 w-36 md:w-44 aspect-video bg-[var(--bg-elevated)] rounded-md flex flex-col items-center justify-center border border-dashed border-[var(--border-subtle)] cursor-pointer hover:border-[var(--border-visible)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <span className="font-mono text-lg text-[var(--text-muted)]">+{remaining}</span>
            <span className="font-mono text-[9px] text-[var(--text-muted)] uppercase tracking-wider mt-1">more</span>
          </div>
        )}
      </div>

      {/* Fullscreen video player */}
      {playerOpen && clips[currentIndex] && (
        <VideoPlayer
          clip={clips[currentIndex]}
          clips={clips}
          currentIndex={currentIndex}
          onClose={handleClosePlayer}
          onNavigate={handleNavigate}
        />
      )}
    </>
  );
}

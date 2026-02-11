'use client';

import { useState } from 'react';
import type { Clip } from '@/lib/types';
import VideoPlayer from './VideoPlayer';
import { playSelect, playStop, playNavigate, playHover, initAudio } from '@/lib/sounds';
import { resolveThumbnailUrl } from '@/lib/publicAssets';

interface ClipWithVideo extends Clip {
  video?: { filename: string };
}

interface ClipCarouselProps {
  clips: ClipWithVideo[];
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
    initAudio();
    playSelect();
    setCurrentIndex(index);
    setPlayerOpen(true);
  };

  const handleClosePlayer = () => {
    playStop();
    setPlayerOpen(false);
  };

  const handleNavigate = (index: number) => {
    playNavigate();
    setCurrentIndex(index);
  };

  const handleThumbnailHover = () => {
    playHover();
  };

  const displayClips = clips.slice(0, 6);
  const remaining = clips.length - 6;

  return (
    <>
      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto hide-scrollbar pl-4 pb-4 sm:pl-6 sm:pb-6">
        {displayClips.map((clip, index) => {
          const thumbPath = resolveThumbnailUrl(clip);
          
          return (
            <div
              key={clip.id}
              onClick={() => handleOpenPlayer(index)}
              onMouseEnter={handleThumbnailHover}
              className="clip-thumb flex-shrink-0 w-36 sm:w-44 md:w-56 cursor-pointer group"
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
            className="flex-shrink-0 w-36 sm:w-44 md:w-56 aspect-video bg-[var(--bg-elevated)] flex flex-col items-center justify-center border-l border-dashed border-[var(--border-subtle)] cursor-pointer hover:border-[var(--border-visible)] hover:bg-[var(--bg-hover)] transition-colors"
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

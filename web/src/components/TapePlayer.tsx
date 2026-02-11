'use client';

import { useState, useCallback } from 'react';
import type { Clip } from '@/lib/types';
import VideoPlayer from './VideoPlayer';
import { resolveThumbnailUrl } from '@/lib/publicAssets';
import { playSelect, playStop, playNavigate, playHover, initAudio } from '@/lib/sounds';

interface ClipWithVideo extends Clip {
  video?: { filename: string };
}

interface TapeInfo {
  videoId: string;
  title: string;
  clips: ClipWithVideo[];
}

interface TapePlayerProps {
  /** All tapes in display order, each with their clips */
  tapes: TapeInfo[];
  /** Which tape to show the carousel for */
  tapeIndex: number;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * A clip carousel that supports cross-tape navigation via up/down arrows.
 * Renders the thumbnails for one tape, but when the player is open,
 * up/down jumps to the first clip of the previous/next tape.
 */
export default function TapePlayer({ tapes, tapeIndex }: TapePlayerProps) {
  const [playerOpen, setPlayerOpen] = useState(false);
  const [activeTape, setActiveTape] = useState(tapeIndex);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);

  const tape = tapes[activeTape];
  const clips = tape?.clips ?? [];
  const displayClips = tapes[tapeIndex].clips.slice(0, 6);
  const remaining = tapes[tapeIndex].clips.length - 6;

  const handleOpenPlayer = (index: number) => {
    initAudio();
    playSelect();
    setActiveTape(tapeIndex); // Reset to this tape when opening
    setCurrentClipIndex(index);
    setPlayerOpen(true);
  };

  const handleClosePlayer = () => {
    playStop();
    setPlayerOpen(false);
    setActiveTape(tapeIndex); // Reset
  };

  const handleNavigateClip = (index: number) => {
    playNavigate();
    setCurrentClipIndex(index);
  };

  const handlePrevTape = useCallback(() => {
    if (activeTape > 0) {
      playNavigate();
      setActiveTape(activeTape - 1);
      setCurrentClipIndex(0);
    }
  }, [activeTape]);

  const handleNextTape = useCallback(() => {
    if (activeTape < tapes.length - 1) {
      playNavigate();
      setActiveTape(activeTape + 1);
      setCurrentClipIndex(0);
    }
  }, [activeTape, tapes.length]);

  const prevTape = activeTape > 0 ? tapes[activeTape - 1] : null;
  const nextTape = activeTape < tapes.length - 1 ? tapes[activeTape + 1] : null;

  return (
    <>
      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto hide-scrollbar pl-4 pb-4 sm:pl-6 sm:pb-6">
        {displayClips.map((clip, index) => {
          const thumbPath = resolveThumbnailUrl(clip);

          return (
            <div
              key={clip.id}
              onClick={() => handleOpenPlayer(index)}
              onMouseEnter={playHover}
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
                    <path d="M8 5v14l11-7z" />
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

      {/* Fullscreen player with tape navigation */}
      {playerOpen && clips[currentClipIndex] && (
        <VideoPlayer
          clip={clips[currentClipIndex]}
          clips={clips}
          currentIndex={currentClipIndex}
          onClose={handleClosePlayer}
          onNavigate={handleNavigateClip}
          onPrevTape={prevTape ? handlePrevTape : undefined}
          onNextTape={nextTape ? handleNextTape : undefined}
          prevTapeLabel={prevTape?.title}
          nextTapeLabel={nextTape?.title}
        />
      )}
    </>
  );
}

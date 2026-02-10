'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Clip } from '@/lib/types';
import { playNavigate, playStop, playStart } from '@/lib/sounds';
import { resolveClipUrl } from '@/lib/publicAssets';

interface ClipWithVideo extends Clip {
  video?: { filename: string };
}

interface VideoPlayerProps {
  clip: ClipWithVideo;
  clips: ClipWithVideo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function downloadFilename(clip: ClipWithVideo): string {
  const label = clip.description || clip.filename?.replace('.mp4', '').replace(/-/g, ' ') || 'clip';
  // Sanitise for filesystem
  const safe = label.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
  return `${safe}.mp4`;
}

export default function VideoPlayer({ clip, clips, currentIndex, onClose, onNavigate }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clipPath = resolveClipUrl(clip);
  
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < clips.length - 1;

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      playNavigate();
      onNavigate(currentIndex - 1);
    }
  }, [hasPrev, currentIndex, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      playNavigate();
      onNavigate(currentIndex + 1);
    }
  }, [hasNext, currentIndex, onNavigate]);

  const handleClose = useCallback(() => {
    playStop();
    onClose();
  }, [onClose]);

  // Play start sound when player opens
  useEffect(() => {
    playStart();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleClose();
          break;
        case 'ArrowLeft':
          handlePrev();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case ' ':
          e.preventDefault();
          if (videoRef.current) {
            if (videoRef.current.paused) {
              videoRef.current.play();
            } else {
              videoRef.current.pause();
            }
          }
          break;
        case 'd':
        case 'D': {
          const a = document.createElement('a');
          a.href = clipPath;
          a.download = downloadFilename(clip);
          a.click();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, handlePrev, handleNext, clip, clipPath]);

  // Auto-advance to next video when current ends
  const handleEnded = () => {
    if (hasNext) {
      handleNext();
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Client-only guard for portal target
  if (typeof document === 'undefined') return null;

  const playerContent = (
    <div className="fixed inset-0 z-[9999] bg-black">
      {/* Top-right actions */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
        {/* Download button */}
        <a
          href={clipPath}
          download={downloadFilename(clip)}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Download clip"
          title="Download clip"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
          </svg>
        </a>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Counter */}
      <div className="absolute top-6 left-6 z-20 font-mono text-sm text-white/60">
        <span className="text-white">{currentIndex + 1}</span>
        <span className="mx-1">/</span>
        <span>{clips.length}</span>
      </div>

      {/* Video container — pb-32 reserves space so native controls aren't covered by info bar */}
      <div className="absolute inset-0 flex items-center justify-center p-4 pb-36 pt-16 md:px-12 md:pb-40 md:pt-20">
        <div className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
          <video
            ref={videoRef}
            src={clipPath}
            autoPlay
            controls
            playsInline
            onEnded={handleEnded}
            className="w-full h-full object-contain relative z-10"
          />
          
          {/* VHS overlay effect */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
            }}
          />
        </div>
      </div>

      {/* Navigation arrows */}
      {hasPrev && (
        <button
          onClick={handlePrev}
          className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
          aria-label="Previous clip"
        >
          <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      
      {hasNext && (
        <button
          onClick={handleNext}
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors group"
          aria-label="Next clip"
        >
          <svg className="w-6 h-6 text-white group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Bottom info bar — z-10 so it doesn't block the video scrubber */}
      <div className="absolute bottom-0 left-0 right-0 z-[5] bg-gradient-to-t from-black/80 to-transparent p-6 md:p-8 pointer-events-none">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-2">
            <span className="font-mono text-xs text-[var(--amber)] uppercase tracking-wider">
              Now Playing
            </span>
            {clip.duration_seconds && (
              <span className="font-mono text-xs text-white/50">
                {formatDuration(clip.duration_seconds)}
              </span>
            )}
          </div>
          <p className="text-white/90 text-sm md:text-base max-w-2xl leading-relaxed">
            {clip.description || clip.filename?.replace('.mp4', '').replace(/-/g, ' ')}
          </p>
          
          {/* Keyboard hints */}
          <div className="flex items-center gap-4 mt-4 text-white/40 text-xs font-mono">
            <span>← → Navigate</span>
            <span>Space Pause</span>
            <span>D Download</span>
            <span>Esc Close</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document body level
  return createPortal(playerContent, document.body);
}

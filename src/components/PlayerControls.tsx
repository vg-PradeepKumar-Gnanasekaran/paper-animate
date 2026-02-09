'use client';

import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Gauge,
  Clock,
} from 'lucide-react';
import { PlayerState } from '@/types';

interface PlayerControlsProps {
  playerState: PlayerState;
  totalSections: number;
  totalDuration: number;
  currentTime: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onPrevSection: () => void;
  onNextSection: () => void;
  onSpeedChange: (speed: number) => void;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PlayerControls({
  playerState,
  totalSections,
  totalDuration,
  currentTime,
  onPlay,
  onPause,
  onReset,
  onPrevSection,
  onNextSection,
  onSpeedChange,
  onSeek,
}: PlayerControlsProps) {
  const speeds = [0.5, 1, 1.5, 2];
  const globalProgress = totalDuration > 0 ? currentTime / totalDuration : 0;

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    onSeek(progress * totalDuration);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-6 py-3 shadow-sm space-y-2">
      {/* Global timeline scrubber */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-gray-400" />
          <span className="text-[11px] font-mono text-gray-500 min-w-[36px]">
            {formatTime(currentTime)}
          </span>
        </div>

        <div
          className="flex-1 h-2 bg-gray-100 rounded-full cursor-pointer relative group"
          onClick={handleScrub}
        >
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-150 relative"
            style={{ width: `${globalProgress * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-600 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        <span className="text-[11px] font-mono text-gray-400 min-w-[36px] text-right">
          {formatTime(totalDuration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between">
        {/* Left: Section navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevSection}
            disabled={playerState.currentSection === 0}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous section"
          >
            <SkipBack className="w-4 h-4 text-gray-700" />
          </button>

          <span className="text-sm font-medium text-gray-600 min-w-[80px] text-center">
            {playerState.currentSection + 1} / {totalSections}
          </span>

          <button
            onClick={onNextSection}
            disabled={playerState.currentSection === totalSections - 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next section"
          >
            <SkipForward className="w-4 h-4 text-gray-700" />
          </button>
        </div>

        {/* Center: Play controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4 text-gray-600" />
          </button>

          <button
            onClick={playerState.isPlaying ? onPause : onPlay}
            className="p-3 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-colors shadow-md"
            title={playerState.isPlaying ? 'Pause' : 'Play'}
          >
            {playerState.isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>
        </div>

        {/* Right: Speed control + section progress */}
        <div className="flex items-center gap-3">
          <Gauge className="w-4 h-4 text-gray-400" />
          <div className="flex items-center gap-1">
            {speeds.map((speed) => (
              <button
                key={speed}
                onClick={() => onSpeedChange(speed)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  playerState.speed === speed
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Section progress bar */}
          <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all duration-300"
              style={{ width: `${playerState.progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import { Button } from '@/components/ui/button';
import type { PlaybackState } from '../types';
import { formatTime } from '../utils/formatTime';

interface Props {
  playbackState: PlaybackState;
  audioBuffer: AudioBuffer;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSeek: (time: number) => void;
}

export default function TransportControls({
  playbackState,
  audioBuffer,
  onPlay,
  onPause,
  onStop,
  onSeek,
}: Props) {
  const totalDuration = playbackState.duration || audioBuffer.duration || 0;
  const progress = totalDuration > 0 ? (playbackState.currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 px-0.5 py-1.5 shrink-0">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={playbackState.isPlaying ? onPause : onPlay}
        title={playbackState.isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {playbackState.isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="7,4 20,12 7,20" />
          </svg>
        )}
      </Button>

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onStop}
        title="Stop"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="1.5" />
        </svg>
      </Button>

      <span className="font-mono text-[11px] text-muted-foreground tabular-nums min-w-[48px]">
        {formatTime(playbackState.currentTime)}
      </span>

      <div
        className="flex-1 relative cursor-pointer group"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          onSeek(Math.max(0, Math.min(totalDuration, pct * totalDuration)));
        }}
      >
        <div className="absolute -top-3 -bottom-3 left-0 right-0 max-[640px]:-top-5 max-[640px]:-bottom-5" />
        <div className="relative h-1.5 max-[640px]:h-3 rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary/50 group-hover:bg-primary/70 transition-colors"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>

      <span className="font-mono text-[11px] text-muted-foreground/60 tabular-nums min-w-[48px] text-right">
        {formatTime(totalDuration)}
      </span>
    </div>
  );
}

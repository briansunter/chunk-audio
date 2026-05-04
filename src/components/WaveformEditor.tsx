import { useRef, useEffect, useCallback, useState } from 'react';
import type { AudioFile, CutPoint, Segment, EditorTool } from '../types';
import { drawWaveform, xToTime } from '../utils/waveform';

interface Props {
  audioFile: AudioFile;
  segments: Segment[];
  cutPoints: CutPoint[];
  chunkLines: number[];
  playbackTime: number;
  activeTool: EditorTool;
  isChunkMode: boolean;
  onAddCut: (time: number) => void;
  onMoveCut: (id: string, newTime: number) => void;
  onRemoveCut: (id: string) => void;
  onSeek: (time: number) => void;
}

export default function WaveformEditor({
  audioFile,
  segments,
  cutPoints,
  chunkLines,
  playbackTime,
  activeTool,
  isChunkMode,
  onAddCut,
  onMoveCut,
  onRemoveCut,
  onSeek,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const draggingCut = useRef<string | null>(null);
  const isTouchDevice = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvasSize.width === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    drawWaveform(
      ctx,
      audioFile.waveformData,
      canvasSize.width,
      canvasSize.height,
      segments,
      cutPoints,
      chunkLines,
      playbackTime,
      audioFile.duration,
    );
  }, [audioFile, segments, cutPoints, chunkLines, playbackTime, canvasSize]);

  const findCutNearX = useCallback((x: number): CutPoint | null => {
    const width = canvasRef.current?.clientWidth || 0;
    if (!width) return null;
    const threshold = isTouchDevice.current ? 20 : 8;

    for (const cut of cutPoints) {
      const cutX = (cut.time / audioFile.duration) * width;
      if (Math.abs(x - cutX) < threshold) return cut;
    }
    return null;
  }, [cutPoints, audioFile.duration]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, x));
    const nearCut = findCutNearX(clampedX);

    if (nearCut) {
      if (e.button === 2 || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        onRemoveCut(nearCut.id);
      } else {
        draggingCut.current = nearCut.id;
      }
      return;
    }

    const time = xToTime(clampedX, rect.width, audioFile.duration);

    if (!isChunkMode && activeTool === 'blade') {
      onAddCut(time);
    } else {
      onSeek(time);
    }
  }, [activeTool, audioFile.duration, findCutNearX, onAddCut, onSeek, onRemoveCut, isChunkMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingCut.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const time = Math.max(0.1, Math.min(audioFile.duration - 0.1, xToTime(x, rect.width, audioFile.duration)));
    onMoveCut(draggingCut.current, time);
  }, [audioFile.duration, onMoveCut]);

  const handleMouseUp = useCallback(() => {
    draggingCut.current = null;
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isTouchDevice.current = true;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, x));
    const nearCut = findCutNearX(clampedX);

    if (nearCut) {
      e.preventDefault();
      const cutId = nearCut.id;
      longPressTimer.current = setTimeout(() => {
        onRemoveCut(cutId);
        draggingCut.current = null;
        longPressTimer.current = null;
      }, 600);
      draggingCut.current = cutId;
      return;
    }

    const time = xToTime(clampedX, rect.width, audioFile.duration);
    if (!isChunkMode && activeTool === 'blade') {
      onAddCut(time);
    } else {
      onSeek(time);
    }
  }, [activeTool, audioFile.duration, findCutNearX, onAddCut, onSeek, onRemoveCut, isChunkMode, clearLongPress]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    clearLongPress();
    if (!draggingCut.current) return;
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touch = e.touches[0];
    const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
    const time = Math.max(0.1, Math.min(audioFile.duration - 0.1, xToTime(x, rect.width, audioFile.duration)));
    onMoveCut(draggingCut.current, time);
  }, [audioFile.duration, onMoveCut, clearLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    draggingCut.current = null;
  }, [clearLongPress]);

  const cursorClass = !isChunkMode && activeTool === 'blade'
    ? 'cursor-crosshair'
    : 'cursor-pointer';

  return (
    <div
      ref={containerRef}
      className={`waveform-editor ${cursorClass}`}
    >
      <canvas
        ref={canvasRef}
        style={{ width: canvasSize.width, height: canvasSize.height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={e => e.preventDefault()}
        className="rounded-lg"
      />
    </div>
  );
}

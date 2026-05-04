import { useState, useCallback, useRef, useEffect } from 'react';
import type { AudioFile, CutPoint, Segment, EditorTool, PlaybackState } from '../types';

const SEGMENT_COLORS = [
  '#5eead4', '#60a5fa', '#fbbf24', '#f87171', '#c084fc',
  '#22d3ee', '#facc15', '#f472b6', '#a3e635', '#fb923c',
];

let nextId = 1;
function uid(): string {
  return `cp-${nextId++}`;
}

export function useAudioEditor(audioFile: AudioFile | null) {
  const [activeTool, setActiveTool] = useState<EditorTool>('blade');
  const [cutPoints, setCutPoints] = useState<CutPoint[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentOrder, setSegmentOrder] = useState<string[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playStartRef = useRef<{ time: number; offset: number }>({ time: 0, offset: 0 });
  const animFrameRef = useRef<number>(0);

  const resetState = useCallback((duration: number) => {
    setCutPoints([]);
    setSegments([]);
    setSegmentOrder([]);
    setPlaybackState({ isPlaying: false, currentTime: 0, duration });
  }, []);

  // Derive segments from cut points
  const deriveSegments = useCallback((cuts: CutPoint[], duration: number): Segment[] => {
    const sorted = [...cuts].sort((a, b) => a.time - b.time);
    const segs: Segment[] = [];
    let prev = 0;

    for (let i = 0; i < sorted.length; i++) {
      const seg: Segment = {
        id: `seg-${i}`,
        startTime: prev,
        endTime: sorted[i].time,
        label: `Segment ${i + 1}`,
        color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
        enabled: true,
      };
      segs.push(seg);
      prev = sorted[i].time;
    }

    segs.push({
      id: `seg-${sorted.length}`,
      startTime: prev,
      endTime: duration,
      label: `Segment ${sorted.length + 1}`,
      color: SEGMENT_COLORS[sorted.length % SEGMENT_COLORS.length],
      enabled: true,
    });

    return segs;
  }, []);

  const addCutPoint = useCallback((time: number) => {
    setCutPoints(prev => {
      const next = [...prev, { id: uid(), time }];
      if (audioFile) {
        setSegments(deriveSegments(next, audioFile.duration));
        setSegmentOrder(deriveSegments(next, audioFile.duration).map(s => s.id));
      }
      return next;
    });
  }, [audioFile, deriveSegments]);

  const moveCutPoint = useCallback((id: string, newTime: number) => {
    setCutPoints(prev => {
      const next = prev.map(cp => cp.id === id ? { ...cp, time: newTime } : cp);
      if (audioFile) {
        setSegments(deriveSegments(next, audioFile.duration));
      }
      return next;
    });
  }, [audioFile, deriveSegments]);

  const removeCutPoint = useCallback((id: string) => {
    setCutPoints(prev => {
      const next = prev.filter(cp => cp.id !== id);
      if (audioFile) {
        const newSegments = deriveSegments(next, audioFile.duration);
        setSegments(newSegments);
        setSegmentOrder(newSegments.map(s => s.id));
      }
      return next;
    });
  }, [audioFile, deriveSegments]);

  const toggleSegmentEnabled = useCallback((segId: string) => {
    setSegments(prev => prev.map(s => s.id === segId ? { ...s, enabled: !s.enabled } : s));
  }, []);

  const reorderSegments = useCallback((newOrder: string[]) => {
    setSegmentOrder(newOrder);
  }, []);

  // Playback
  const stopPlayback = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    setPlaybackState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const play = useCallback(() => {
    if (!audioFile) return;
    stopPlayback();

    const ctx = audioContextRef.current || new AudioContext();
    audioContextRef.current = ctx;

    const source = ctx.createBufferSource();
    source.buffer = audioFile.audioBuffer;
    source.connect(ctx.destination);

    const offset = playbackState.currentTime;
    source.start(0, offset);
    sourceRef.current = source;
    playStartRef.current = { time: ctx.currentTime, offset };

    setPlaybackState(prev => ({ ...prev, isPlaying: true }));

    const tick = () => {
      const elapsed = ctx.currentTime - playStartRef.current.time + playStartRef.current.offset;
      if (elapsed >= audioFile.duration) {
        stopPlayback();
        setPlaybackState({ isPlaying: false, currentTime: 0, duration: audioFile.duration });
        return;
      }
      setPlaybackState(prev => ({ ...prev, currentTime: elapsed }));
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    source.onended = () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = 0;
      }
      setPlaybackState(prev => {
        if (prev.isPlaying) {
          return { isPlaying: false, currentTime: 0, duration: prev.duration };
        }
        return prev;
      });
    };
  }, [audioFile, playbackState.currentTime, stopPlayback]);

  const pause = useCallback(() => {
    if (!audioFile || !sourceRef.current) return;
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const elapsed = ctx.currentTime - playStartRef.current.time + playStartRef.current.offset;
    stopPlayback();
    setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTime: elapsed }));
  }, [audioFile, stopPlayback]);

  const stop = useCallback(() => {
    stopPlayback();
    setPlaybackState(prev => ({ ...prev, isPlaying: false, currentTime: 0 }));
  }, [stopPlayback]);

  const seek = useCallback((time: number) => {
    const wasPlaying = playbackState.isPlaying;
    stopPlayback();
    setPlaybackState(prev => ({ ...prev, currentTime: time }));
  }, [stopPlayback, playbackState.isPlaying]);

  useEffect(() => {
    return () => {
      stopPlayback();
      audioContextRef.current?.close();
    };
  }, [stopPlayback]);

  return {
    activeTool,
    setTool: setActiveTool,
    cutPoints,
    segments,
    segmentOrder,
    playbackState,
    resetState,
    addCutPoint,
    moveCutPoint,
    removeCutPoint,
    toggleSegmentEnabled,
    reorderSegments,
    play,
    pause,
    stop,
    seek,
  };
}

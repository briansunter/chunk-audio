import { useEffect, useRef, useState, useCallback } from 'react';
import { createFFmpeg, FFmpeg } from '@ffmpeg/ffmpeg';

export function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ffmpeg = createFFmpeg({ log: true });
    ffmpegRef.current = ffmpeg;

    ffmpeg.setProgress(({ ratio }) => {
      setProgress(Math.max(0, Math.min(1, ratio)));
    });

    ffmpeg.load().then(() => {
      setIsLoaded(true);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load FFmpeg');
    });
  }, []);

  const runCommand = useCallback(async (...args: string[]) => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !isLoaded) throw new Error('FFmpeg not loaded');

    setIsProcessing(true);
    setProgress(0);
    setError(null);
    try {
      await ffmpeg.run(...args);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'FFmpeg command failed';
      setError(msg);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [isLoaded]);

  const writeFile = useCallback(async (name: string, data: Uint8Array | string) => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) throw new Error('FFmpeg not initialized');
    ffmpeg.FS('writeFile', name, data);
  }, []);

  const readFile = useCallback((name: string): Uint8Array => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) throw new Error('FFmpeg not initialized');
    return ffmpeg.FS('readFile', name) as Uint8Array;
  }, []);

  const readdir = useCallback((path: string): string[] => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) throw new Error('FFmpeg not initialized');
    return ffmpeg.FS('readdir', path) as string[];
  }, []);

  const unlink = useCallback((name: string) => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) throw new Error('FFmpeg not initialized');
    ffmpeg.FS('unlink', name);
  }, []);

  const cleanup = useCallback((...names: string[]) => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) return;
    for (const name of names) {
      try { ffmpeg.FS('unlink', name); } catch {}
    }
  }, []);

  return {
    isLoaded,
    isProcessing,
    progress,
    error,
    runCommand,
    writeFile,
    readFile,
    readdir,
    unlink,
    cleanup,
  };
}

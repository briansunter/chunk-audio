import type { Segment } from '../types';

export async function chunkByTime(
  ffmpeg: {
    runCommand: (...args: string[]) => Promise<void>;
    writeFile: (name: string, data: Uint8Array | string) => Promise<void>;
    readFile: (name: string) => Uint8Array;
    readdir: (path: string) => string[];
    cleanup: (...names: string[]) => void;
  },
  inputName: string,
  chunkDuration: number,
  outputFormat: string,
): Promise<{ name: string; data: Uint8Array }[]> {
  const ext = outputFormat === 'mp3' ? 'mp3' : outputFormat;
  const outputPattern = `chunk_%03d.${ext}`;

  // Convert to target format if needed, then segment
  const tempName = `temp_converted.${ext}`;
  await ffmpeg.runCommand('-i', inputName, '-codec:a', 'libmp3lame', '-qscale:a', '2', tempName);
  await ffmpeg.runCommand('-i', tempName, '-f', 'segment', '-segment_time', String(chunkDuration), '-c', 'copy', outputPattern);

  const allFiles = ffmpeg.readdir('/');
  const chunkFiles = allFiles.filter(f => f.startsWith('chunk_'));

  const results: { name: string; data: Uint8Array }[] = [];
  for (const f of chunkFiles) {
    results.push({ name: f, data: ffmpeg.readFile(f) });
  }

  ffmpeg.cleanup(tempName, ...chunkFiles);
  return results;
}

export async function extractSegments(
  ffmpeg: {
    runCommand: (...args: string[]) => Promise<void>;
    writeFile: (name: string, data: Uint8Array | string) => Promise<void>;
    readFile: (name: string) => Uint8Array;
    readdir: (path: string) => string[];
    cleanup: (...names: string[]) => void;
  },
  inputName: string,
  segments: Segment[],
  outputFormat: string,
): Promise<{ name: string; data: Uint8Array }[]> {
  const ext = outputFormat === 'mp3' ? 'mp3' : outputFormat;
  const results: { name: string; data: Uint8Array }[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const outputName = `seg_${String(i + 1).padStart(3, '0')}.${ext}`;
    const startTime = formatFfmpegTime(seg.startTime);
    const endTime = formatFfmpegTime(seg.endTime);

    await ffmpeg.runCommand(
      '-i', inputName,
      '-ss', startTime,
      '-to', endTime,
      '-c', 'copy',
      outputName,
    );

    results.push({ name: outputName, data: ffmpeg.readFile(outputName) });
    ffmpeg.cleanup(outputName);
  }

  return results;
}

function formatFfmpegTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = (seconds % 60).toFixed(3);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.padStart(6, '0')}`;
}

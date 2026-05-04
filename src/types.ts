export interface AudioFile {
  file: File;
  name: string;
  duration: number;
  arrayBuffer: ArrayBuffer;
  waveformData: Float32Array;
  audioBuffer: AudioBuffer;
}

export interface CutPoint {
  id: string;
  time: number;
}

export interface Segment {
  id: string;
  startTime: number;
  endTime: number;
  label: string;
  color: string;
  enabled: boolean;
}

export type EditorTool = 'select' | 'blade';

export type EditorMode = 'chunk' | 'manual';

export interface ExportOptions {
  mode: EditorMode;
  chunkDuration: number;
  outputFormat: 'mp3' | 'wav' | 'ogg';
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
}

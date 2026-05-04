import type { CutPoint, Segment } from '../types';

export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array,
  width: number,
  height: number,
  segments: Segment[],
  cutPoints: CutPoint[],
  chunkLines: number[],
  playbackTime: number,
  duration: number,
) {
  const w = width;
  const h = height;
  const mid = h / 2;

  ctx.clearRect(0, 0, w, h);

  // Background
  ctx.fillStyle = '#141420';
  ctx.fillRect(0, 0, w, h);

  // Grid
  drawGrid(ctx, w, h, duration);

  // Waveform — draw as filled path for smooth appearance
  const sampleCount = peaks.length / 2;
  const hasSegments = segments.length > 0;

  if (!hasSegments) {
    // Single waveform, no segments
    drawWaveformPath(ctx, peaks, 0, sampleCount, w, h, mid, '#5eead4', 1.0);
  } else {
    // Draw each segment with its own color
    for (const seg of segments) {
      const startSample = Math.floor((seg.startTime / duration) * sampleCount);
      const endSample = Math.floor((seg.endTime / duration) * sampleCount);

      ctx.save();
      const clipStart = (seg.startTime / duration) * w;
      const clipEnd = (seg.endTime / duration) * w;
      ctx.beginPath();
      ctx.rect(clipStart, 0, clipEnd - clipStart, h);
      ctx.clip();

      const alpha = seg.enabled ? 1.0 : 0.2;
      drawWaveformPath(ctx, peaks, startSample, endSample, w, h, mid, seg.color, alpha);

      ctx.restore();
    }
  }

  // Center line
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();

  // Chunk auto-slice lines (subtle, no handles)
  for (const t of chunkLines) {
    drawChunkLine(ctx, (t / duration) * w, h);
  }

  // Manual cut markers
  for (const cut of cutPoints) {
    drawCutMarker(ctx, (cut.time / duration) * w, h);
  }

  // Playhead
  if (playbackTime >= 0 && playbackTime <= duration) {
    drawPlayhead(ctx, (playbackTime / duration) * w, h);
  }
}

function drawWaveformPath(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array,
  startSample: number,
  endSample: number,
  totalWidth: number,
  totalHeight: number,
  mid: number,
  color: string,
  alpha: number,
) {
  const sampleCount = peaks.length / 2;
  const count = endSample - startSample;
  if (count <= 0) return;

  // Build top and bottom paths
  const topPoints: number[] = [];
  const bottomPoints: number[] = [];

  for (let i = startSample; i < endSample && i < sampleCount; i++) {
    const min = peaks[i * 2];
    const max = peaks[i * 2 + 1];
    const x = (i / sampleCount) * totalWidth;

    topPoints.push(x, mid + max * mid * 0.9);
    bottomPoints.push(x, mid + min * mid * 0.9);
  }

  if (topPoints.length === 0) return;

  // Glow layer
  ctx.save();
  ctx.globalAlpha = alpha * 0.08;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;

  ctx.beginPath();
  ctx.moveTo(topPoints[0], topPoints[1]);
  for (let i = 2; i < topPoints.length; i += 2) {
    ctx.lineTo(topPoints[i], topPoints[i + 1]);
  }
  for (let i = bottomPoints.length - 2; i >= 0; i -= 2) {
    ctx.lineTo(bottomPoints[i], bottomPoints[i + 1]);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();

  // Main fill
  ctx.save();
  ctx.globalAlpha = alpha * 0.6;

  const gradient = ctx.createLinearGradient(0, 0, 0, totalHeight);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.45, color);
  gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.55, color);
  gradient.addColorStop(1, color);

  ctx.beginPath();
  ctx.moveTo(topPoints[0], topPoints[1]);
  for (let i = 2; i < topPoints.length; i += 2) {
    ctx.lineTo(topPoints[i], topPoints[i + 1]);
  }
  for (let i = bottomPoints.length - 2; i >= 0; i -= 2) {
    ctx.lineTo(bottomPoints[i], bottomPoints[i + 1]);
  }
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  // Top edge line
  ctx.save();
  ctx.globalAlpha = alpha * 0.8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(topPoints[0], topPoints[1]);
  for (let i = 2; i < topPoints.length; i += 2) {
    ctx.lineTo(topPoints[i], topPoints[i + 1]);
  }
  ctx.stroke();

  // Bottom edge line
  ctx.beginPath();
  ctx.moveTo(bottomPoints[0], bottomPoints[1]);
  for (let i = 2; i < bottomPoints.length; i += 2) {
    ctx.lineTo(bottomPoints[i], bottomPoints[i + 1]);
  }
  ctx.stroke();
  ctx.restore();
}

function drawCutMarker(ctx: CanvasRenderingContext2D, x: number, h: number) {
  // Dashed line
  ctx.save();
  ctx.strokeStyle = '#f0a050';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x, 14);
  ctx.lineTo(x, h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Top handle
  ctx.fillStyle = '#f0a050';
  ctx.beginPath();
  ctx.moveTo(x - 5, 0);
  ctx.lineTo(x + 5, 0);
  ctx.lineTo(x, 8);
  ctx.closePath();
  ctx.fill();
}

function drawChunkLine(ctx: CanvasRenderingContext2D, x: number, h: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Small diamond marker at top
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + 4, 5);
  ctx.lineTo(x, 10);
  ctx.lineTo(x - 4, 5);
  ctx.closePath();
  ctx.fill();
}

function drawPlayhead(ctx: CanvasRenderingContext2D, x: number, h: number) {
  // Line
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h);
  ctx.stroke();

  // Top handle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x - 4, 0);
  ctx.lineTo(x + 4, 0);
  ctx.lineTo(x, 7);
  ctx.closePath();
  ctx.fill();
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  duration: number,
) {
  let interval: number;
  if (duration < 60) interval = 5;
  else if (duration < 300) interval = 10;
  else if (duration < 1800) interval = 30;
  else if (duration < 7200) interval = 60;
  else interval = 300;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;

  for (let t = interval; t < duration; t += interval) {
    const x = (t / duration) * w;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  ctx.restore();
}

export function xToTime(x: number, width: number, duration: number): number {
  return (x / width) * duration;
}

export function timeToX(time: number, width: number, duration: number): number {
  return (time / duration) * width;
}

import type { CutPoint, Segment } from "../types";

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
	loopRange?: { startTime: number; endTime: number },
	viewportStart: number = 0,
	viewportEnd?: number,
) {
	const vEnd = viewportEnd ?? duration;
	const viewDur = vEnd - viewportStart;
	const tToX = (t: number) => ((t - viewportStart) / viewDur) * width;

	const w = width;
	const h = height;
	const mid = h / 2;

	ctx.clearRect(0, 0, w, h);

	// Background
	ctx.fillStyle = "#141420";
	ctx.fillRect(0, 0, w, h);

	// Grid
	drawGrid(ctx, w, h, viewDur, viewportStart);

	// Waveform
	const sampleCount = peaks.length / 2;
	const hasSegments = segments.length > 0;

	if (!hasSegments) {
		const startSample = Math.max(
			0,
			Math.floor((viewportStart / duration) * sampleCount),
		);
		const endSample = Math.min(
			sampleCount,
			Math.ceil((vEnd / duration) * sampleCount),
		);
		drawWaveformPath(
			ctx,
			peaks,
			startSample,
			endSample,
			w,
			h,
			mid,
			"#5eead4",
			1.0,
			duration,
			viewportStart,
			viewDur,
		);
	} else {
		for (const seg of segments) {
			if (seg.endTime <= viewportStart || seg.startTime >= vEnd) continue;

			const startSample = Math.max(
				0,
				Math.floor(
					(Math.max(seg.startTime, viewportStart) / duration) * sampleCount,
				),
			);
			const endSample = Math.min(
				sampleCount,
				Math.ceil((Math.min(seg.endTime, vEnd) / duration) * sampleCount),
			);

			ctx.save();
			const clipStart = tToX(Math.max(seg.startTime, viewportStart));
			const clipEnd = tToX(Math.min(seg.endTime, vEnd));
			ctx.beginPath();
			ctx.rect(clipStart, 0, clipEnd - clipStart, h);
			ctx.clip();

			const alpha = seg.enabled ? 1.0 : 0.2;
			drawWaveformPath(
				ctx,
				peaks,
				startSample,
				endSample,
				w,
				h,
				mid,
				seg.color,
				alpha,
				duration,
				viewportStart,
				viewDur,
			);

			ctx.restore();
		}
	}

	// Center line
	ctx.strokeStyle = "rgba(255,255,255,0.06)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, mid);
	ctx.lineTo(w, mid);
	ctx.stroke();

	// Chunk lines
	for (const t of chunkLines) {
		if (t < viewportStart || t > vEnd) continue;
		drawChunkLine(ctx, tToX(t), h);
	}

	// Cut markers
	for (const cut of cutPoints) {
		if (cut.time < viewportStart || cut.time > vEnd) continue;
		drawCutMarker(ctx, tToX(cut.time), h);
	}

	// Playhead
	if (playbackTime >= viewportStart && playbackTime <= vEnd) {
		drawPlayhead(ctx, tToX(playbackTime), h);
	}

	// Loop range
	if (loopRange) {
		drawLoopRange(ctx, tToX(loopRange.startTime), tToX(loopRange.endTime), h);
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
	fullDuration?: number,
	viewStart?: number,
	viewDur?: number,
) {
	const sampleCount = peaks.length / 2;
	const count = endSample - startSample;
	if (count <= 0) return;

	const viewport =
		fullDuration !== undefined &&
		viewStart !== undefined &&
		viewDur !== undefined
			? { full: fullDuration, start: viewStart, dur: viewDur }
			: null;

	const topPoints: number[] = [];
	const bottomPoints: number[] = [];

	for (let i = startSample; i < endSample && i < sampleCount; i++) {
		const min = peaks[i * 2];
		const max = peaks[i * 2 + 1];
		let x: number;
		if (viewport) {
			const sampleTime = (i / sampleCount) * viewport.full;
			x = ((sampleTime - viewport.start) / viewport.dur) * totalWidth;
		} else {
			x = (i / sampleCount) * totalWidth;
		}

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
	gradient.addColorStop(0.5, "rgba(0,0,0,0)");
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
	ctx.save();
	ctx.strokeStyle = "#f0a050";
	ctx.lineWidth = 1;
	ctx.setLineDash([4, 3]);
	ctx.beginPath();
	ctx.moveTo(x, 14);
	ctx.lineTo(x, h);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.restore();

	ctx.fillStyle = "#f0a050";
	ctx.beginPath();
	ctx.moveTo(x - 5, 0);
	ctx.lineTo(x + 5, 0);
	ctx.lineTo(x, 8);
	ctx.closePath();
	ctx.fill();
}

function drawChunkLine(ctx: CanvasRenderingContext2D, x: number, h: number) {
	ctx.save();
	ctx.strokeStyle = "rgba(255,255,255,0.35)";
	ctx.lineWidth = 1;
	ctx.setLineDash([4, 3]);
	ctx.beginPath();
	ctx.moveTo(x, 0);
	ctx.lineTo(x, h);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.restore();

	ctx.fillStyle = "rgba(255,255,255,0.5)";
	ctx.beginPath();
	ctx.moveTo(x, 0);
	ctx.lineTo(x + 4, 5);
	ctx.lineTo(x, 10);
	ctx.lineTo(x - 4, 5);
	ctx.closePath();
	ctx.fill();
}

function drawPlayhead(ctx: CanvasRenderingContext2D, x: number, h: number) {
	ctx.save();
	ctx.strokeStyle = "rgba(255,255,255,0.2)";
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.moveTo(x, 0);
	ctx.lineTo(x, h);
	ctx.stroke();
	ctx.restore();

	ctx.strokeStyle = "#ffffff";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, 0);
	ctx.lineTo(x, h);
	ctx.stroke();

	ctx.fillStyle = "#ffffff";
	ctx.beginPath();
	ctx.moveTo(x - 4, 0);
	ctx.lineTo(x + 4, 0);
	ctx.lineTo(x, 7);
	ctx.closePath();
	ctx.fill();
}

function drawLoopRange(
	ctx: CanvasRenderingContext2D,
	startX: number,
	endX: number,
	h: number,
) {
	ctx.save();
	ctx.fillStyle = "rgba(94, 234, 212, 0.06)";
	ctx.fillRect(startX, 0, endX - startX, h);

	ctx.strokeStyle = "rgba(94, 234, 212, 0.4)";
	ctx.lineWidth = 1;
	ctx.setLineDash([3, 3]);
	ctx.beginPath();
	ctx.moveTo(startX, 0);
	ctx.lineTo(startX, h);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(endX, 0);
	ctx.lineTo(endX, h);
	ctx.stroke();
	ctx.setLineDash([]);

	ctx.fillStyle = "rgba(94, 234, 212, 0.7)";
	ctx.font = "9px monospace";
	ctx.fillText("LOOP", startX + 4, 12);
	ctx.restore();
}

function drawGrid(
	ctx: CanvasRenderingContext2D,
	w: number,
	h: number,
	viewDur: number,
	viewStart: number = 0,
) {
	let interval: number;
	if (viewDur < 10) interval = 0.5;
	else if (viewDur < 60) interval = 5;
	else if (viewDur < 300) interval = 10;
	else if (viewDur < 1800) interval = 30;
	else if (viewDur < 7200) interval = 60;
	else interval = 300;

	ctx.save();
	ctx.strokeStyle = "rgba(255,255,255,0.04)";
	ctx.lineWidth = 1;

	const firstLine = Math.ceil(viewStart / interval) * interval;
	for (let t = firstLine; t < viewStart + viewDur; t += interval) {
		const x = ((t - viewStart) / viewDur) * w;
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

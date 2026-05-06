import { useRef, useEffect, useCallback, useState } from "react";
import type { AudioFile, CutPoint, Segment, EditorTool } from "../types";
import { drawWaveform } from "../utils/waveform";

interface Props {
	audioFile: AudioFile;
	segments: Segment[];
	cutPoints: CutPoint[];
	chunkLines: number[];
	playbackTime: number;
	activeTool: EditorTool;
	isChunkMode: boolean;
	loopRange?: { startTime: number; endTime: number };
	onAddCut: (time: number) => void;
	onMoveCut: (id: string, newTime: number) => void;
	onRemoveCut: (id: string) => void;
	onSeek: (time: number) => void;
}

/** Minimum visible duration (can't zoom in further than 1 second) */
const MIN_VIEWPORT_DURATION = 1;

export default function WaveformEditor({
	audioFile,
	segments,
	cutPoints,
	chunkLines,
	playbackTime,
	activeTool,
	isChunkMode,
	loopRange,
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

	// Zoom viewport state: the time range visible in the canvas
	const [viewportStart, setViewportStart] = useState(0);
	const [viewportEnd, setViewportEnd] = useState(audioFile.duration);

	// Panning state. The ref drives the actual pan logic; the state is purely
	// for cursor display so the canvas re-renders the grabbing cursor.
	const isPanning = useRef(false);
	const [isPanningState, setIsPanningState] = useState(false);
	const panStartX = useRef(0);
	const panStartViewport = useRef({ start: 0, end: 0 });

	// Pinch-zoom state for two-finger touch gestures.
	const isPinching = useRef(false);
	const pinchStart = useRef({
		distance: 0,
		viewportStart: 0,
		viewportDuration: 0,
		anchorTime: 0,
		anchorRatio: 0,
	});

	// Reset viewport when audio file changes
	useEffect(() => {
		setViewportStart(0);
		setViewportEnd(audioFile.duration);
	}, [audioFile.duration]);

	const viewportDuration = viewportEnd - viewportStart;

	// Helper: convert canvas X to time within viewport
	const xToViewportTime = useCallback(
		(x: number, width: number): number => {
			return viewportStart + (x / width) * viewportDuration;
		},
		[viewportStart, viewportDuration],
	);

	// Helper: convert time to canvas X within viewport
	const timeToViewportX = useCallback(
		(time: number, width: number): number => {
			return ((time - viewportStart) / viewportDuration) * width;
		},
		[viewportStart, viewportDuration],
	);

	// Resize observer
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const { width, height } = entry.contentRect;
				setCanvasSize({
					width: Math.max(1, Math.round(width)),
					height: Math.max(1, Math.round(height)),
				});
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

		const ctx = canvas.getContext("2d");
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
			loopRange,
			viewportStart,
			viewportEnd,
		);
	}, [
		audioFile,
		segments,
		cutPoints,
		chunkLines,
		playbackTime,
		canvasSize,
		loopRange,
		viewportStart,
		viewportEnd,
	]);

	const findCutNearX = useCallback(
		(x: number): CutPoint | null => {
			const width = canvasRef.current?.clientWidth || 0;
			if (!width) return null;
			const threshold = isTouchDevice.current ? 20 : 8;

			for (const cut of cutPoints) {
				const cutX = timeToViewportX(cut.time, width);
				if (Math.abs(x - cutX) < threshold) return cut;
			}
			return null;
		},
		[cutPoints, timeToViewportX],
	);

	// Zoom handler. Attached as a non-passive native listener in an effect
	// below so preventDefault() actually blocks page scroll — React's
	// synthetic onWheel is registered passively in React 17+.
	const handleWheel = useCallback(
		(e: WheelEvent) => {
			e.preventDefault();
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const mouseX = e.clientX - rect.left;
			const mouseTime = xToViewportTime(mouseX, rect.width);

			// Zoom factor: scroll up = zoom in, scroll down = zoom out
			const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
			const newDuration = Math.max(
				MIN_VIEWPORT_DURATION,
				Math.min(audioFile.duration, viewportDuration * factor),
			);

			// Keep the mouse time pinned at the same X position
			const ratio = (mouseTime - viewportStart) / viewportDuration;
			const newStart = mouseTime - ratio * newDuration;
			const newEnd = newStart + newDuration;

			// Clamp
			const clampedStart = Math.max(
				0,
				Math.min(audioFile.duration - newDuration, newStart),
			);
			const clampedEnd = clampedStart + newDuration;

			setViewportStart(clampedStart);
			setViewportEnd(Math.min(audioFile.duration, clampedEnd));
		},
		[audioFile.duration, viewportDuration, viewportStart, xToViewportTime],
	);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		canvas.addEventListener("wheel", handleWheel, { passive: false });
		return () => canvas.removeEventListener("wheel", handleWheel);
	}, [handleWheel]);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
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

			// Middle-click or Alt+click for panning
			if (e.button === 1 || e.altKey) {
				e.preventDefault();
				isPanning.current = true;
				setIsPanningState(true);
				panStartX.current = e.clientX;
				panStartViewport.current = { start: viewportStart, end: viewportEnd };
				return;
			}

			const time = xToViewportTime(clampedX, rect.width);

			if (!isChunkMode && activeTool === "blade") {
				onAddCut(time);
			} else {
				onSeek(time);
			}
		},
		[
			activeTool,
			findCutNearX,
			onAddCut,
			onSeek,
			onRemoveCut,
			isChunkMode,
			xToViewportTime,
			viewportStart,
			viewportEnd,
		],
	);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			// Handle panning
			if (isPanning.current) {
				const rect = canvasRef.current?.getBoundingClientRect();
				if (!rect) return;
				const dx = e.clientX - panStartX.current;
				const timeDelta =
					-(dx / rect.width) *
					(panStartViewport.current.end - panStartViewport.current.start);
				let newStart = panStartViewport.current.start + timeDelta;
				let newEnd = panStartViewport.current.end + timeDelta;
				// Clamp
				if (newStart < 0) {
					newEnd -= newStart;
					newStart = 0;
				}
				if (newEnd > audioFile.duration) {
					newStart -= newEnd - audioFile.duration;
					newEnd = audioFile.duration;
				}
				newStart = Math.max(0, newStart);
				setViewportStart(newStart);
				setViewportEnd(newEnd);
				return;
			}

			if (!draggingCut.current) return;
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
			const time = Math.max(
				0.1,
				Math.min(audioFile.duration - 0.1, xToViewportTime(x, rect.width)),
			);
			onMoveCut(draggingCut.current, time);
		},
		[audioFile.duration, onMoveCut, xToViewportTime],
	);

	const handleMouseUp = useCallback(() => {
		draggingCut.current = null;
		if (isPanning.current) {
			isPanning.current = false;
			setIsPanningState(false);
		}
	}, []);

	const clearLongPress = useCallback(() => {
		if (longPressTimer.current) {
			clearTimeout(longPressTimer.current);
			longPressTimer.current = null;
		}
	}, []);

	const handleTouchStart = useCallback(
		(e: React.TouchEvent) => {
			isTouchDevice.current = true;
			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			// Two-finger pinch starts a zoom gesture. Cancel any in-flight single-
			// touch interactions so we don't accidentally place a cut.
			if (e.touches.length >= 2) {
				clearLongPress();
				draggingCut.current = null;
				const t1 = e.touches[0];
				const t2 = e.touches[1];
				const dx = t2.clientX - t1.clientX;
				const dy = t2.clientY - t1.clientY;
				const distance = Math.max(1, Math.hypot(dx, dy));
				const midX = (t1.clientX + t2.clientX) / 2 - rect.left;
				const anchorTime = xToViewportTime(
					Math.max(0, Math.min(rect.width, midX)),
					rect.width,
				);
				isPinching.current = true;
				pinchStart.current = {
					distance,
					viewportStart,
					viewportDuration,
					anchorTime,
					anchorRatio: viewportDuration
						? (anchorTime - viewportStart) / viewportDuration
						: 0.5,
				};
				return;
			}

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

			const time = xToViewportTime(clampedX, rect.width);
			if (!isChunkMode && activeTool === "blade") {
				onAddCut(time);
			} else {
				onSeek(time);
			}
		},
		[
			activeTool,
			findCutNearX,
			onAddCut,
			onSeek,
			onRemoveCut,
			isChunkMode,
			xToViewportTime,
			clearLongPress,
			viewportStart,
			viewportDuration,
		],
	);

	const handleTouchMove = useCallback(
		(e: React.TouchEvent) => {
			// Pinch-to-zoom: two-finger gesture changes the visible time window.
			if (isPinching.current && e.touches.length >= 2) {
				e.preventDefault();
				const t1 = e.touches[0];
				const t2 = e.touches[1];
				const dx = t2.clientX - t1.clientX;
				const dy = t2.clientY - t1.clientY;
				const distance = Math.max(1, Math.hypot(dx, dy));
				const start = pinchStart.current;
				const newDuration = Math.max(
					MIN_VIEWPORT_DURATION,
					Math.min(
						audioFile.duration,
						start.viewportDuration * (start.distance / distance),
					),
				);
				// Keep the gesture's anchor time pinned at the same screen position.
				const newStartTime = start.anchorTime - start.anchorRatio * newDuration;
				const clampedStart = Math.max(
					0,
					Math.min(audioFile.duration - newDuration, newStartTime),
				);
				setViewportStart(clampedStart);
				setViewportEnd(clampedStart + newDuration);
				return;
			}

			clearLongPress();
			if (!draggingCut.current) return;
			e.preventDefault();

			const rect = canvasRef.current?.getBoundingClientRect();
			if (!rect) return;

			const touch = e.touches[0];
			const x = Math.max(0, Math.min(rect.width, touch.clientX - rect.left));
			const time = Math.max(
				0.1,
				Math.min(audioFile.duration - 0.1, xToViewportTime(x, rect.width)),
			);
			onMoveCut(draggingCut.current, time);
		},
		[audioFile.duration, onMoveCut, xToViewportTime, clearLongPress],
	);

	const handleTouchEnd = useCallback(
		(e: React.TouchEvent) => {
			// End pinch as soon as we drop below two fingers.
			if (isPinching.current && e.touches.length < 2) {
				isPinching.current = false;
			}
			clearLongPress();
			if (e.touches.length === 0) {
				draggingCut.current = null;
			}
		},
		[clearLongPress],
	);

	const isZoomed = viewportDuration < audioFile.duration - 0.1;

	const cursorClass = isPanningState
		? "cursor-grabbing"
		: !isChunkMode && activeTool === "blade"
			? "cursor-crosshair"
			: "cursor-pointer";

	return (
		<div ref={containerRef} className={`waveform-editor ${cursorClass}`}>
			<canvas
				ref={canvasRef}
				style={{
					width: canvasSize.width,
					height: canvasSize.height,
					// Suppress native pan/pinch on the canvas so our touch handlers own
					// gestures (pinch-to-zoom, drag cuts, place cuts).
					touchAction: "none",
				}}
				onMouseDown={handleMouseDown}
				onMouseMove={handleMouseMove}
				onMouseUp={handleMouseUp}
				onMouseLeave={handleMouseUp}
				onTouchStart={handleTouchStart}
				onTouchMove={handleTouchMove}
				onTouchEnd={handleTouchEnd}
				onTouchCancel={handleTouchEnd}
				onContextMenu={(e) => e.preventDefault()}
				className="rounded-lg"
			/>
			{isZoomed && (
				<button
					onClick={() => {
						setViewportStart(0);
						setViewportEnd(audioFile.duration);
					}}
					title="Zoom to fit"
					className="absolute top-1 right-1 text-[9px] font-mono text-muted-foreground hover:text-foreground bg-background/80 px-1.5 py-0.5 rounded border border-border cursor-pointer"
				>
					Fit
				</button>
			)}
		</div>
	);
}

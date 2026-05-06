import { useState, useCallback, useRef, useEffect } from "react";
import type {
	AudioFile,
	CutPoint,
	Segment,
	EditorTool,
	PlaybackState,
} from "../types";

const SEGMENT_COLORS = [
	"#5eead4",
	"#60a5fa",
	"#fbbf24",
	"#f87171",
	"#c084fc",
	"#22d3ee",
	"#facc15",
	"#f472b6",
	"#a3e635",
	"#fb923c",
];

let nextId = 1;
function uid(): string {
	return `cp-${nextId++}`;
}

interface EditorSnapshot {
	cutPoints: CutPoint[];
	segments: Segment[];
	segmentOrder: string[];
}

const MAX_HISTORY = 50;
const CUT_DEDUPE_EPSILON = 0.05;

export function useAudioEditor(audioFile: AudioFile | null) {
	const [activeTool, setActiveTool] = useState<EditorTool>("blade");
	const [cutPoints, setCutPoints] = useState<CutPoint[]>([]);
	const [segments, setSegments] = useState<Segment[]>([]);
	const [segmentOrder, setSegmentOrder] = useState<string[]>([]);
	const [playbackState, setPlaybackState] = useState<PlaybackState>({
		isPlaying: false,
		currentTime: 0,
		duration: 0,
	});

	const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<string>>(
		new Set(),
	);

	const undoStackRef = useRef<EditorSnapshot[]>([]);
	const redoStackRef = useRef<EditorSnapshot[]>([]);
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);

	// Live mirrors of state used by stable callbacks (avoids stale-closure bugs
	// and keeps callback identities stable across re-renders).
	const cutPointsRef = useRef(cutPoints);
	const segmentsRef = useRef(segments);
	const segmentOrderRef = useRef(segmentOrder);
	const selectedSegmentIdsRef = useRef(selectedSegmentIds);
	const loopRangeRef = useRef<PlaybackState["loopRange"]>(undefined);
	const currentTimeRef = useRef(0);
	cutPointsRef.current = cutPoints;
	segmentsRef.current = segments;
	segmentOrderRef.current = segmentOrder;
	selectedSegmentIdsRef.current = selectedSegmentIds;
	loopRangeRef.current = playbackState.loopRange;
	currentTimeRef.current = playbackState.currentTime;

	const audioContextRef = useRef<AudioContext | null>(null);
	const sourceRef = useRef<AudioBufferSourceNode | null>(null);
	const playStartRef = useRef<{ time: number; offset: number }>({
		time: 0,
		offset: 0,
	});
	const animFrameRef = useRef<number>(0);

	// ─── Playback primitives ────────────────────────────────────

	const stopPlayback = useCallback(() => {
		if (animFrameRef.current) {
			cancelAnimationFrame(animFrameRef.current);
			animFrameRef.current = 0;
		}
		if (sourceRef.current) {
			try {
				sourceRef.current.onended = null;
				sourceRef.current.stop();
			} catch {}
			sourceRef.current = null;
		}
		setPlaybackState((prev) => ({ ...prev, isPlaying: false }));
	}, []);

	// ─── State reset ────────────────────────────────────────────

	const resetState = useCallback(
		(duration: number) => {
			stopPlayback();
			setCutPoints([]);
			setSegments([]);
			setSegmentOrder([]);
			setPlaybackState({ isPlaying: false, currentTime: 0, duration });
			setSelectedSegmentIds(new Set());
			loopRangeRef.current = undefined;
			undoStackRef.current = [];
			redoStackRef.current = [];
			setCanUndo(false);
			setCanRedo(false);
		},
		[stopPlayback],
	);

	// ─── Segment derivation ─────────────────────────────────────

	const deriveSegments = useCallback(
		(cuts: CutPoint[], duration: number): Segment[] => {
			const sorted = [...cuts].sort((a, b) => a.time - b.time);
			const segs: Segment[] = [];
			let prev = 0;

			for (let i = 0; i < sorted.length; i++) {
				segs.push({
					id: `seg-${i}`,
					startTime: prev,
					endTime: sorted[i].time,
					label: `Segment ${i + 1}`,
					color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
					enabled: true,
				});
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
		},
		[],
	);

	// ─── Undo / Redo ────────────────────────────────────────────

	// Reads from refs, not closure, so back-to-back operations within a single
	// React batch always see the latest state.
	const pushUndo = useCallback(() => {
		const snapshot: EditorSnapshot = {
			cutPoints: [...cutPointsRef.current],
			segments: segmentsRef.current.map((s) => ({ ...s })),
			segmentOrder: [...segmentOrderRef.current],
		};
		undoStackRef.current.push(snapshot);
		if (undoStackRef.current.length > MAX_HISTORY) {
			undoStackRef.current.shift();
		}
		redoStackRef.current = [];
		setCanUndo(true);
		setCanRedo(false);
	}, []);

	const undo = useCallback(() => {
		if (undoStackRef.current.length === 0) return;

		const currentSnapshot: EditorSnapshot = {
			cutPoints: [...cutPointsRef.current],
			segments: segmentsRef.current.map((s) => ({ ...s })),
			segmentOrder: [...segmentOrderRef.current],
		};
		redoStackRef.current.push(currentSnapshot);

		const prev = undoStackRef.current.pop()!;
		setCutPoints(prev.cutPoints);
		setSegments(prev.segments);
		setSegmentOrder(prev.segmentOrder);

		setCanUndo(undoStackRef.current.length > 0);
		setCanRedo(true);
	}, []);

	const redo = useCallback(() => {
		if (redoStackRef.current.length === 0) return;

		const currentSnapshot: EditorSnapshot = {
			cutPoints: [...cutPointsRef.current],
			segments: segmentsRef.current.map((s) => ({ ...s })),
			segmentOrder: [...segmentOrderRef.current],
		};
		undoStackRef.current.push(currentSnapshot);

		const next = redoStackRef.current.pop()!;
		setCutPoints(next.cutPoints);
		setSegments(next.segments);
		setSegmentOrder(next.segmentOrder);

		setCanUndo(true);
		setCanRedo(redoStackRef.current.length > 0);
	}, []);

	// ─── Cut point operations ───────────────────────────────────

	const addCutPoint = useCallback(
		(time: number) => {
			if (!audioFile) return;
			// Skip duplicates within epsilon to avoid zero-duration segments.
			if (
				cutPointsRef.current.some(
					(cp) => Math.abs(cp.time - time) < CUT_DEDUPE_EPSILON,
				)
			)
				return;
			// Also skip near segment boundaries (0 or duration).
			if (time < CUT_DEDUPE_EPSILON) return;
			if (time > audioFile.duration - CUT_DEDUPE_EPSILON) return;

			pushUndo();
			setCutPoints((prev) => {
				const next = [...prev, { id: uid(), time }];
				const newSegs = deriveSegments(next, audioFile.duration);
				setSegments(newSegs);
				setSegmentOrder(newSegs.map((s) => s.id));
				return next;
			});
		},
		[audioFile, deriveSegments, pushUndo],
	);

	const moveCutPoint = useCallback(
		(id: string, newTime: number) => {
			if (!audioFile) return;
			pushUndo();
			setCutPoints((prev) => {
				const next = prev.map((cp) =>
					cp.id === id ? { ...cp, time: newTime } : cp,
				);
				setSegments(deriveSegments(next, audioFile.duration));
				return next;
			});
		},
		[audioFile, deriveSegments, pushUndo],
	);

	const removeCutPoint = useCallback(
		(id: string) => {
			if (!audioFile) return;
			pushUndo();
			setCutPoints((prev) => {
				const next = prev.filter((cp) => cp.id !== id);
				const newSegments = deriveSegments(next, audioFile.duration);
				setSegments(newSegments);
				setSegmentOrder(newSegments.map((s) => s.id));
				return next;
			});
		},
		[audioFile, deriveSegments, pushUndo],
	);

	// ─── Segment operations ─────────────────────────────────────

	const toggleSegmentEnabled = useCallback(
		(segId: string) => {
			pushUndo();
			setSegments((prev) =>
				prev.map((s) => (s.id === segId ? { ...s, enabled: !s.enabled } : s)),
			);
		},
		[pushUndo],
	);

	const reorderSegments = useCallback(
		(newOrder: string[]) => {
			pushUndo();
			setSegmentOrder(newOrder);
		},
		[pushUndo],
	);

	const deleteSegment = useCallback(
		(segId: string) => {
			if (!audioFile) return;
			const seg = segmentsRef.current.find((s) => s.id === segId);
			if (!seg) return;

			const cuts = cutPointsRef.current;
			const endCutIdx = cuts.findIndex(
				(cp) => Math.abs(cp.time - seg.endTime) < 0.01,
			);
			const startCutIdx = cuts.findIndex(
				(cp) => Math.abs(cp.time - seg.startTime) < 0.01,
			);

			let newCuts: CutPoint[];
			if (endCutIdx >= 0) {
				newCuts = cuts.filter((_, i) => i !== endCutIdx);
			} else if (startCutIdx >= 0) {
				newCuts = cuts.filter((_, i) => i !== startCutIdx);
			} else {
				return;
			}

			pushUndo();
			const newSegments = deriveSegments(newCuts, audioFile.duration);
			setCutPoints(newCuts);
			setSegments(newSegments);
			setSegmentOrder(newSegments.map((s) => s.id));
		},
		[audioFile, deriveSegments, pushUndo],
	);

	const renameSegment = useCallback((segId: string, name: string) => {
		setSegments((prev) =>
			prev.map((s) =>
				s.id === segId ? { ...s, customName: name || undefined } : s,
			),
		);
	}, []);

	// ─── Multi-select ───────────────────────────────────────────

	const toggleSegmentSelection = useCallback(
		(segId: string, exclusive?: boolean) => {
			setSelectedSegmentIds((prev) => {
				const next = new Set(exclusive ? [] : prev);
				if (next.has(segId)) {
					next.delete(segId);
				} else {
					next.add(segId);
				}
				return next;
			});
		},
		[],
	);

	const selectSegmentRange = useCallback((segId: string) => {
		setSelectedSegmentIds((prev) => {
			if (prev.size === 0) return new Set([segId]);
			const orderedIds = segmentOrderRef.current;
			const selectedIndices = [...prev]
				.map((id) => orderedIds.indexOf(id))
				.filter((i) => i >= 0);
			const targetIndex = orderedIds.indexOf(segId);
			if (targetIndex < 0) return prev;

			const minIdx = Math.min(...selectedIndices, targetIndex);
			const maxIdx = Math.max(...selectedIndices, targetIndex);
			const rangeIds = orderedIds.slice(minIdx, maxIdx + 1);
			return new Set(rangeIds);
		});
	}, []);

	const clearSelection = useCallback(() => {
		setSelectedSegmentIds(new Set());
	}, []);

	const selectAllSegments = useCallback(() => {
		setSelectedSegmentIds(new Set(segmentsRef.current.map((s) => s.id)));
	}, []);

	const deleteSelectedSegments = useCallback(() => {
		if (!audioFile) return;
		const selectedIds = selectedSegmentIdsRef.current;
		if (selectedIds.size === 0) return;

		const segs = segmentsRef.current;
		const cuts = cutPointsRef.current;
		const selectedSegs = segs.filter((s) => selectedIds.has(s.id));
		if (selectedSegs.length === 0 || selectedSegs.length >= segs.length) return;

		const cutTimesToRemove = new Set<number>();
		for (const seg of selectedSegs) {
			const endCut = cuts.find(
				(cp) => Math.abs(cp.time - seg.endTime) < 0.01,
			);
			const startCut = cuts.find(
				(cp) => Math.abs(cp.time - seg.startTime) < 0.01,
			);
			if (endCut) cutTimesToRemove.add(endCut.time);
			else if (startCut) cutTimesToRemove.add(startCut.time);
		}

		pushUndo();
		const newCuts = cuts.filter((cp) => !cutTimesToRemove.has(cp.time));
		const newSegments = deriveSegments(newCuts, audioFile.duration);
		setCutPoints(newCuts);
		setSegments(newSegments);
		setSegmentOrder(newSegments.map((s) => s.id));
		setSelectedSegmentIds(new Set());
	}, [audioFile, deriveSegments, pushUndo]);

	// ─── Playback ───────────────────────────────────────────────

	// Stable identity: reads volatile state (currentTime, loopRange) via refs,
	// so callers (keyboard handlers, etc.) don't re-attach every frame.
	const play = useCallback(
		(from?: number, loop?: { startTime: number; endTime: number } | null) => {
			if (!audioFile) return;
			stopPlayback();

			const ctx = audioContextRef.current || new AudioContext();
			audioContextRef.current = ctx;

			// If `loop` is provided, set/clear it; otherwise use whatever is current.
			if (loop !== undefined) {
				loopRangeRef.current = loop ?? undefined;
			}

			const offset = from ?? currentTimeRef.current;
			const startSource = (atOffset: number) => {
				const source = ctx.createBufferSource();
				source.buffer = audioFile.audioBuffer;
				source.connect(ctx.destination);
				source.start(0, atOffset);
				sourceRef.current = source;
				playStartRef.current = { time: ctx.currentTime, offset: atOffset };
				return source;
			};

			startSource(offset);
			setPlaybackState((prev) => ({
				...prev,
				isPlaying: true,
				currentTime: offset,
				...(loop !== undefined ? { loopRange: loop ?? undefined } : {}),
			}));

			const tick = () => {
				const elapsed =
					ctx.currentTime -
					playStartRef.current.time +
					playStartRef.current.offset;

				const currentLoop = loopRangeRef.current;
				if (currentLoop && elapsed >= currentLoop.endTime) {
					// Restart at loop start to actually loop the range.
					try {
						if (sourceRef.current) {
							sourceRef.current.onended = null;
							sourceRef.current.stop();
						}
					} catch {}
					sourceRef.current = null;
					startSource(currentLoop.startTime);
					setPlaybackState((prev) => ({
						...prev,
						currentTime: currentLoop.startTime,
					}));
					animFrameRef.current = requestAnimationFrame(tick);
					return;
				}

				if (elapsed >= audioFile.duration) {
					stopPlayback();
					setPlaybackState((prev) => ({
						...prev,
						isPlaying: false,
						currentTime: 0,
					}));
					return;
				}
				setPlaybackState((prev) => ({ ...prev, currentTime: elapsed }));
				animFrameRef.current = requestAnimationFrame(tick);
			};
			animFrameRef.current = requestAnimationFrame(tick);
		},
		[audioFile, stopPlayback],
	);

	const pause = useCallback(() => {
		if (!audioFile || !sourceRef.current) return;
		const ctx = audioContextRef.current;
		if (!ctx) return;

		const elapsed =
			ctx.currentTime - playStartRef.current.time + playStartRef.current.offset;
		stopPlayback();
		setPlaybackState((prev) => ({
			...prev,
			isPlaying: false,
			currentTime: elapsed,
		}));
	}, [audioFile, stopPlayback]);

	const stop = useCallback(() => {
		stopPlayback();
		setPlaybackState((prev) => ({ ...prev, isPlaying: false, currentTime: 0 }));
	}, [stopPlayback]);

	const seek = useCallback(
		(time: number) => {
			stopPlayback();
			setPlaybackState((prev) => ({ ...prev, currentTime: time }));
		},
		[stopPlayback],
	);

	// ─── Segment playback / loop ────────────────────────────────

	const playSegment = useCallback(
		(segId: string) => {
			const seg = segmentsRef.current.find((s) => s.id === segId);
			if (!seg || !audioFile) return;
			play(seg.startTime, { startTime: seg.startTime, endTime: seg.endTime });
		},
		[audioFile, play],
	);

	const playSelection = useCallback(() => {
		if (!audioFile) return;
		const selectedIds = selectedSegmentIdsRef.current;
		if (selectedIds.size === 0) return;
		const selectedSegs = segmentsRef.current
			.filter((s) => selectedIds.has(s.id))
			.sort((a, b) => a.startTime - b.startTime);
		if (selectedSegs.length === 0) return;
		play(selectedSegs[0].startTime, {
			startTime: selectedSegs[0].startTime,
			endTime: selectedSegs[selectedSegs.length - 1].endTime,
		});
	}, [audioFile, play]);

	const clearLoopRange = useCallback(() => {
		loopRangeRef.current = undefined;
		setPlaybackState((prev) => {
			const { loopRange: _loopRange, ...rest } = prev;
			return rest;
		});
	}, []);

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
		canUndo,
		canRedo,
		selectedSegmentIds,
		resetState,
		addCutPoint,
		moveCutPoint,
		removeCutPoint,
		toggleSegmentEnabled,
		reorderSegments,
		deleteSegment,
		renameSegment,
		undo,
		redo,
		play,
		pause,
		stop,
		seek,
		toggleSegmentSelection,
		selectSegmentRange,
		clearSelection,
		selectAllSegments,
		deleteSelectedSegments,
		playSegment,
		playSelection,
		clearLoopRange,
	};
}

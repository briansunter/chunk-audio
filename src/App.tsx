import { fetchFile } from "@ffmpeg/ffmpeg";
import { saveAs } from "file-saver";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExportPanel from "./components/ExportPanel";
import FileDropZone from "./components/FileDropZone";
import Header from "./components/Header";
import LoadingOverlay from "./components/LoadingOverlay";
import SegmentTrack from "./components/SegmentTrack";
import TimelineRuler from "./components/TimelineRuler";
import Toolbar from "./components/Toolbar";
import TransportControls from "./components/TransportControls";
import WaveformEditor from "./components/WaveformEditor";
import { useAudioDecoder } from "./hooks/useAudioDecoder";
import { useAudioEditor } from "./hooks/useAudioEditor";
import { useFFmpeg } from "./hooks/useFFmpeg";
import type {
	AudioFile,
	CutPoint,
	EditorMode,
	ExportOptions,
	Segment,
} from "./types";
import { chunkByTime, extractSegments } from "./utils/audioProcessing";

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

function deriveSegments(cuts: CutPoint[], duration: number): Segment[] {
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
}

export default function App() {
	const ffmpeg = useFFmpeg();
	const decoder = useAudioDecoder();
	const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
	const [mode, setMode] = useState<EditorMode>("manual");
	const [chunkDuration, setChunkDuration] = useState(600);

	const editor = useAudioEditor(audioFile);

	// Mirror editor into a ref so event handlers / callbacks can read its
	// latest state without re-binding on every render.
	const editorRef = useRef(editor);
	editorRef.current = editor;

	const handleModeChange = useCallback(
		(newMode: EditorMode) => {
			setMode(newMode);
			// Manual-mode selections don't apply in chunk mode; clear them so the
			// "Export (N)" path can't silently fire against the wrong segments.
			editorRef.current.clearSelection();
			if (newMode === "chunk" && audioFile) {
				// Auto-select a chunk duration that produces 3-20 slices
				const dur = audioFile.duration;
				if (dur <= 120) setChunkDuration(30);
				else if (dur <= 600) setChunkDuration(60);
				else if (dur <= 3600) setChunkDuration(300);
				else setChunkDuration(600);
			}
		},
		[audioFile],
	);

	// Effective cut points: only manual cuts get orange markers
	const effectiveCutPoints = useMemo((): CutPoint[] => {
		if (mode === "chunk") return [];
		return editor.cutPoints;
	}, [mode, editor.cutPoints]);

	// Chunk slice line times — only used in chunk mode
	const chunkLines = useMemo((): number[] => {
		if (mode !== "chunk" || !audioFile) return [];
		const times: number[] = [];
		for (let t = chunkDuration; t < audioFile.duration; t += chunkDuration) {
			times.push(t);
		}
		return times;
	}, [mode, audioFile, chunkDuration]);

	const effectiveSegments = useMemo((): Segment[] => {
		if (!audioFile) return [];
		if (mode === "chunk") {
			const points: CutPoint[] = chunkLines.map((t) => ({
				id: `chunk-${t}`,
				time: t,
			}));
			return deriveSegments(points, audioFile.duration);
		}
		return editor.segments;
	}, [mode, audioFile, chunkLines, editor.segments]);

	const effectiveSegmentOrder = useMemo((): string[] => {
		if (mode === "chunk") return effectiveSegments.map((s) => s.id);
		return editor.segmentOrder;
	}, [mode, effectiveSegments, editor.segmentOrder]);

	// Keyboard shortcuts. Reads `editor` via ref so the listener doesn't
	// re-attach on every animation frame as playback ticks update state.
	useEffect(() => {
		if (!audioFile) return;
		const handler = (e: KeyboardEvent) => {
			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLSelectElement ||
				e.target instanceof HTMLTextAreaElement
			)
				return;
			const ed = editorRef.current;

			// Undo: Ctrl+Z (or Cmd+Z on Mac)
			if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
				e.preventDefault();
				ed.redo();
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "z") {
				e.preventDefault();
				ed.undo();
				return;
			}
			// Select all segments: Ctrl+A
			if ((e.ctrlKey || e.metaKey) && e.key === "a" && mode === "manual") {
				e.preventDefault();
				ed.selectAllSegments();
				return;
			}
			// Escape: clear selection / clear loop
			if (e.key === "Escape") {
				if (ed.selectedSegmentIds.size > 0) {
					ed.clearSelection();
				} else if (ed.playbackState.loopRange) {
					ed.clearLoopRange();
				}
				return;
			}

			switch (e.key) {
				case " ":
					e.preventDefault();
					if (ed.playbackState.isPlaying) ed.pause();
					else ed.play();
					break;
				case "v":
					ed.setTool("select");
					break;
				case "b":
					ed.setTool("blade");
					break;
				case "Delete":
				case "Backspace":
					if (mode !== "manual") break;
					if (ed.selectedSegmentIds.size > 0) {
						e.preventDefault();
						ed.deleteSelectedSegments();
					} else if (ed.cutPoints.length > 0) {
						e.preventDefault();
						ed.removeCutPoint(ed.cutPoints[ed.cutPoints.length - 1].id);
					}
					break;
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [audioFile, mode]);

	const handleFileSelected = useCallback(
		async (file: File) => {
			try {
				const decoded = await decoder.decodeFile(file);
				setAudioFile(decoded);
				editorRef.current.resetState(decoded.duration);
			} catch (err) {
				console.error("Failed to decode audio:", err);
			}
		},
		[decoder],
	);

	const handleExport = useCallback(
		async (options: ExportOptions) => {
			if (!audioFile || !ffmpeg.isLoaded) return;

			const inputName = `input${getFileExtension(audioFile.name)}`;
			const fileData = await fetchFile(audioFile.file);
			await ffmpeg.writeFile(inputName, fileData as Uint8Array);

			try {
				let files: { name: string; data: Uint8Array }[] = [];

				if (options.mode === "chunk") {
					files = await chunkByTime(
						ffmpeg,
						inputName,
						options.chunkDuration,
						options.outputFormat,
					);
				} else {
					const ed = editorRef.current;
					let segmentsToExport = ed.segments.filter((s) => s.enabled);
					if (options.selectedOnly) {
						segmentsToExport = segmentsToExport.filter((s) =>
							ed.selectedSegmentIds.has(s.id),
						);
					}
					files = await extractSegments(
						ffmpeg,
						inputName,
						segmentsToExport,
						options.outputFormat,
					);
				}

				const zip = new JSZip();
				for (const f of files) {
					zip.file(f.name, f.data);
				}
				const blob = await zip.generateAsync({ type: "blob" });
				saveAs(blob, "chunks.zip");
			} finally {
				// Clean up everything we created in the virtual FS, including the
				// input. A failed run could otherwise leak the input file across
				// runs and blow up memory.
				const allFiles = ffmpeg.readdir("/");
				const toClean = allFiles.filter((f) => !f.startsWith("."));
				if (toClean.length > 0) ffmpeg.cleanup(...toClean);
			}
		},
		[audioFile, ffmpeg],
	);

	if (!ffmpeg.isLoaded) {
		return <LoadingOverlay progress={ffmpeg.progress} />;
	}

	return (
		<div className="app-shell">
			<Header />

			<main className="app-main">
				{!audioFile || decoder.isDecoding ? (
					<section className="landing-shell">
						<div className="landing-copy">
							<p className="landing-kicker">In-browser audio tools</p>
							<h2 className="landing-title">
								Split, edit, and export audio — privately
							</h2>
							<p className="landing-description">
								Drop a file, place cuts with the blade tool, rearrange segments,
								then export as ZIP. Everything runs locally via WebAssembly.
							</p>
						</div>

						<FileDropZone
							onFileSelected={handleFileSelected}
							disabled={decoder.isDecoding}
						/>

						<p className="landing-state">
							{decoder.isDecoding
								? "Decoding your audio file..."
								: "Supports MP3, WAV, FLAC, M4A, OGG, AAC and more."}
						</p>

						<div className="landing-features">
							<article className="feature-card">
								<p className="feature-label">Blade tool</p>
								<p className="feature-copy">
									Click to place cut points on the waveform. Drag to reposition,
									right-click to remove.
								</p>
							</article>
							<article className="feature-card">
								<p className="feature-label">Private</p>
								<p className="feature-copy">
									All processing in-browser via WebAssembly. Your files never
									leave your machine.
								</p>
							</article>
							<article className="feature-card">
								<p className="feature-label">Export</p>
								<p className="feature-copy">
									Chunk by time or export manual cuts as MP3, WAV, or OGG in a
									single ZIP.
								</p>
							</article>
						</div>
					</section>
				) : (
					<section className="editor-shell">
						<div className="flex flex-col gap-2.5 flex-1 min-h-0">
							<div className="bg-card border border-border rounded-lg flex-1 min-h-0 flex flex-col overflow-hidden">
								<div className="editor-workspace flex-1 min-h-0">
									<div className="flex items-center justify-between max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-2">
										<div className="meta-strip">
											<span className="meta-pill">{audioFile.name}</span>
											<span className="meta-pill">
												{formatDuration(audioFile.duration)}
											</span>
											<span className="meta-pill">
												{formatBytes(audioFile.file.size)}
											</span>
											<span className="meta-pill">
												{audioFile.audioBuffer.sampleRate}Hz
											</span>
										</div>
										<Toolbar
											activeTool={editor.activeTool}
											mode={mode}
											canUndo={editor.canUndo}
											canRedo={editor.canRedo}
											onToolChange={editor.setTool}
											onModeChange={handleModeChange}
											onUndo={editor.undo}
											onRedo={editor.redo}
										/>
									</div>

									<TimelineRuler duration={audioFile.duration} />

									<div className="waveform-shell">
										<WaveformEditor
											audioFile={audioFile}
											segments={effectiveSegments}
											cutPoints={effectiveCutPoints}
											chunkLines={chunkLines}
											playbackTime={editor.playbackState.currentTime}
											activeTool={editor.activeTool}
											isChunkMode={mode === "chunk"}
											loopRange={editor.playbackState.loopRange}
											onAddCut={editor.addCutPoint}
											onMoveCut={editor.moveCutPoint}
											onRemoveCut={editor.removeCutPoint}
											onSeek={editor.seek}
										/>
									</div>

									<TransportControls
										playbackState={editor.playbackState}
										audioBuffer={audioFile.audioBuffer}
										onPlay={editor.play}
										onPause={editor.pause}
										onStop={editor.stop}
										onSeek={editor.seek}
									/>
								</div>
							</div>

							<div className="flex gap-2 shrink-0 max-[640px]:flex-col max-[640px]:max-h-[40vh] max-[640px]:overflow-hidden">
								{effectiveSegments.length > 1 && (
									<div className="bg-card border border-border rounded-lg flex-1 min-h-0 min-w-0 max-[640px]:w-full overflow-hidden flex flex-col">
										<SegmentTrack
											segments={effectiveSegments}
											segmentOrder={effectiveSegmentOrder}
											selectedSegmentIds={editor.selectedSegmentIds}
											onReorder={
												mode === "manual" ? editor.reorderSegments : undefined
											}
											onToggleEnabled={
												mode === "manual"
													? editor.toggleSegmentEnabled
													: undefined
											}
											onDeleteSegment={
												mode === "manual" ? editor.deleteSegment : undefined
											}
											onToggleSelection={
												mode === "manual"
													? editor.toggleSegmentSelection
													: undefined
											}
											onSelectRange={
												mode === "manual"
													? editor.selectSegmentRange
													: undefined
											}
											onPlaySegment={
												mode === "manual" ? editor.playSegment : undefined
											}
											onRenameSegment={
												mode === "manual" ? editor.renameSegment : undefined
											}
										/>
									</div>
								)}

								<div className="bg-card border border-border rounded-lg shrink-0 max-[640px]:w-full">
									<ExportPanel
										mode={mode}
										chunkDuration={chunkDuration}
										onChunkDurationChange={setChunkDuration}
										isProcessing={ffmpeg.isProcessing}
										progress={ffmpeg.progress}
										hasSelection={
											mode === "manual" && editor.selectedSegmentIds.size > 0
										}
										selectedCount={editor.selectedSegmentIds.size}
										onExport={handleExport}
									/>
								</div>
							</div>
						</div>
					</section>
				)}
			</main>
		</div>
	);
}

function getFileExtension(name: string): string {
	const dot = name.lastIndexOf(".");
	return dot >= 0 ? name.slice(dot) : ".mp3";
}

function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = Math.floor(seconds % 60);
	if (h > 0) return `${h}h ${m}m ${s}s`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const step = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(step));
	return `${(bytes / step ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

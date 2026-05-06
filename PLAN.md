# Chunk Audio — Feature Brainstorm & Roadmap

## Context

Chunk Audio is a browser-based audio splitting tool using ffmpeg.wasm. Currently it supports:

- **File drop** → decode → waveform visualization
- **Chunk mode**: even time-based splitting (30s, 1m, 5m, 10m, 15m, 30m)
- **Manual mode**: blade tool to place cuts, segments appear color-coded
- **Segment track**: drag-to-reorder, enable/disable per segment, double-click to rename, double-click to play
- **Multi-select**: click, Shift+click range, Ctrl/Cmd+click toggle, Ctrl+A all → "Export selected" / bulk delete
- **Loop / audition**: clicking a segment sets a loop range that actually loops on the waveform
- **Export**: MP3/WAV/OGG → ZIP download (correct codec per format)
- **Undo/redo**: snapshot stack across cuts, toggles, reorders, deletes (Ctrl+Z / Ctrl+Shift+Z)
- **Zoom & pan**: mouse-wheel zoom, Alt/middle-click pan, Fit button
- **Playback**: play/pause/stop/seek with playhead on waveform
- **Keyboard shortcuts**: Space, V, B, Delete (selection-aware), Esc, Ctrl+Z/Shift+Z, Ctrl+A

This plan proposes new features organized into tiers by impact and complexity.

---

## Tier 1 — High Impact, Core Editing Improvements

### 1. Remove/Delete Individual Segments

**Problem**: Currently you can toggle segments ON/OFF but can't actually delete a segment from the list. The only way to remove a cut is to delete the cut point, which reshapes all neighboring segments.

**Approach**:

- Add a "×" delete button on each segment card in `SegmentTrack`
- Deleting a segment merges it with its neighbor (the cut point between them is removed)
- In chunk mode, allow deleting a chunk (merges with adjacent)
- Add a right-click context menu on segments: "Delete segment", "Split segment" (adds a cut in the middle)
- Files to modify: `SegmentTrack.tsx`, `useAudioEditor.ts`, `types.ts`

### 2. Multi-Select Segments

**Problem**: No way to select multiple segments for bulk operations (delete, merge, toggle, export-only-selected).

**Approach**:

- Add a `selectedSegmentIds` state to `useAudioEditor`
- Shift+click on segment cards for range select, Ctrl/Cmd+click for toggle select
- Show a selection highlight (ring/border) on selected segments
- Bulk actions toolbar appears when segments are selected:
  - **Merge selected** — combine adjacent selected segments into one (removes intermediate cuts)
  - **Delete selected** — remove all selected segments
  - **Toggle selected** — enable/disable all selected
  - **Export selected only** — override export to only include highlighted segments
- Selection also works on waveform: click on a segment region to select, shift+click to multi-select
- Files to modify: `types.ts` (add `selectedSegmentIds`), `useAudioEditor.ts`, `SegmentTrack.tsx`, `WaveformEditor.tsx`, `ExportPanel.tsx`

### 3. Drag Cut Points Directly on Segment Track

**Problem**: Currently cut points can only be dragged on the waveform, which is imprecise for fine adjustments. The segment track shows no visual connection to the cut boundaries.

**Approach**:

- Add resize handles on segment card edges (left/right borders)
- Dragging a segment's right edge moves the cut point between it and the next segment
- Show a tooltip with the time while dragging (e.g., "2:34.500")
- Visual feedback: the segment card width adjusts in real-time proportional to duration
- Files to modify: `SegmentTrack.tsx`, `useAudioEditor.ts`

### 4. Segment Renaming

**Problem**: Segments are generically named "Segment 1", "Segment 2", etc. For podcast/interview workflows, meaningful names are important.

**Approach**:

- Double-click a segment card label to edit inline
- Store custom names in the `Segment.label` field
- Custom names carry through to export filenames (e.g., `01_intro.mp3`, `02_main-topic.mp3`)
- Auto-numbering prefix option (configurable in export)
- Files to modify: `SegmentTrack.tsx`, `types.ts`, `audioProcessing.ts`

---

## Tier 2 — Workflow & Export Enhancements

### 5. Export as Individual Files (Not Just ZIP)

**Problem**: Currently only exports as a single ZIP. Users sometimes just want one segment.

**Approach**:

- Add export options: "Export all as ZIP", "Export selected", "Export individual"
- Single-click download for individual segments (no ZIP overhead)
- "Download current segment" button on each segment card
- Files to modify: `ExportPanel.tsx`, `App.tsx`, `audioProcessing.ts`

### 6. Custom Filename Pattern

**Problem**: Output files are named `chunk_001.mp3` or `seg_001.mp3`. Users want control over naming.

**Approach**:

- Add a filename template input in ExportPanel: `{name}_{index:03}.{ext}`, `{name}_{segment}.{ext}`
- Available tokens: `{name}` (original filename), `{index}`, `{segment}` (segment label), `{start}`, `{end}`, `{duration}`
- Preview the filenames before export
- Files to modify: `ExportPanel.tsx`, `audioProcessing.ts`

### 7. Fade In / Fade Out per Segment

**Problem**: Hard cuts can create audible clicks. Professional audio workflows need smooth transitions.

**Approach**:

- Add fade-in/fade-out duration controls per segment (default: 0ms)
- Visual indicator on waveform: fade envelope curve drawn at segment boundaries
- Applied during export via ffmpeg `afade` filter
- Global default fade setting + per-segment override
- Files to modify: `SegmentTrack.tsx`, `WaveformEditor.tsx` (draw fades), `types.ts` (add fade fields), `audioProcessing.ts` (ffmpeg `-afade`)

### 8. Undo / Redo History

**Problem**: The design spec explicitly lists "No undo/redo history beyond removing the last cut point" as a limitation. This is a significant UX gap.

**Approach**:

- Add an undo/redo stack in `useAudioEditor` using a state snapshot approach
- Each action (add cut, remove cut, move cut, reorder, toggle, delete segment) pushes a snapshot
- Keyboard shortcuts: Ctrl+Z undo, Ctrl+Shift+Z redo
- Visual: undo/redo buttons in the toolbar
- Limit stack to ~50 entries to avoid memory issues
- Files to modify: `useAudioEditor.ts`, `Toolbar.tsx`

### 9. Zoom & Scroll on Waveform

**Problem**: Long audio files (1h+) make the waveform very compressed. Users can't see detail to place precise cuts.

**Approach**:

- Add zoom controls: mouse wheel to zoom in/out, pinch on mobile
- Horizontal scrollbar when zoomed in
- Zoom-to-fit, zoom-to-selection, zoom-to-region buttons
- Mini overview bar at the top showing the full waveform with a viewport indicator
- Keyboard: +/- to zoom, arrow keys to scroll
- Files to modify: `WaveformEditor.tsx` (major refactor), new `WaveformOverview.tsx` component

---

## Tier 3 — UI/UX Polish

### 10. Segment Duration Labels on Waveform

**Problem**: The waveform shows segment colors but doesn't display their durations directly on the canvas.

**Approach**:

- Draw duration text centered on each segment region in the waveform
- Show segment labels (or truncated labels) directly on the waveform bars
- Hovering a segment highlights its label
- Files to modify: `WaveformEditor.tsx`, `waveform.ts`

### 11. Playback Range / Loop a Segment

**Problem**: Can only play from current position to end. No way to audition a specific segment.

**Approach**:

- Click a segment card to set playback range to that segment
- Add a "loop" toggle that repeats the selected segment
- Visual: loop icon on segment cards, loop region highlighted on waveform
- Double-click segment card to play just that segment
- Files to modify: `SegmentTrack.tsx`, `useAudioEditor.ts` (add `loopRange` to `PlaybackState`), `TransportControls.tsx`

### 12. Progress Indicator on Segments During Export

**Problem**: During export, only a percentage bar is shown. Users don't know which segment is being processed.

**Approach**:

- Highlight the currently-processing segment card with a pulsing border
- Show per-segment status: pending → processing → done
- Sequential progress: "Processing segment 3 of 12..."
- Files to modify: `ExportPanel.tsx`, `SegmentTrack.tsx`, `App.tsx`

### 13. Dark/Light Theme Toggle

**Problem**: Currently dark-only. Some users prefer light mode, especially on mobile in daylight.

**Approach**:

- Add theme toggle button in Header
- Store preference in localStorage
- Define light theme CSS variables alongside existing dark theme
- Respect `prefers-color-scheme` as default
- Files to modify: `Header.tsx`, `index.css`, new `useTheme.ts` hook

### 14. Keyboard Shortcuts Overlay

**Problem**: Shortcuts exist (Space, V, B, Delete) but are undocumented in the UI. Users have to discover them.

**Approach**:

- Add a "?" help button in the toolbar or header
- Pressing "?" opens a shortcuts overlay/panel
- Show all shortcuts: Space, V, B, Delete, Ctrl+Z (when undo lands), +/- (when zoom lands)
- Files to modify: `Toolbar.tsx` or `Header.tsx`, new `ShortcutsOverlay.tsx`

### 15. Drag & Drop Segment Reorder Visual Feedback

**Problem**: The drag reorder works but could have better visual feedback (insertion line, ghost preview).

**Approach**:

- Show a vertical insertion line between segments during drag
- Ghost card follows cursor with reduced opacity
- Animate the shuffle as other cards make room
- Files to modify: `SegmentTrack.tsx` (DndContext configuration)

---

## Tier 4 — Advanced / Power Features

### 16. Silence Detection (Auto-Split)

**Problem**: Time-based chunking splits at arbitrary points. Users often want to split at natural pauses (silences between sentences, paragraphs, speakers).

**Approach**:

- Add "Silence detect" as a third mode alongside Chunk/Manual
- Use ffmpeg `silencedetect` filter to find silence boundaries
- Configurable: silence threshold (dB), minimum silence duration (ms)
- Preview detected silence points on waveform as faint markers
- Option to place cuts at silence midpoints or at start/end of silences
- Files to modify: `types.ts` (new mode), `Toolbar.tsx`, `WaveformEditor.tsx`, `audioProcessing.ts` (new `detectSilence()`)

### 17. Waveform Caching in IndexedDB

**Problem**: Re-loading the same file requires full re-decode every time (noted in design spec limitations).

**Approach**:

- Hash the file (first 1KB + size + name) as a cache key
- Store decoded waveform peaks + AudioBuffer in IndexedDB
- On file drop, check cache first — instant load if cached
- Show "Loaded from cache" indicator
- Files to modify: new `useWaveformCache.ts` hook, `useAudioDecoder.ts`

### 18. Persisted Settings via localStorage

**Problem**: Users lose their preferred format, chunk duration, mode on every page reload (noted in design spec).

**Approach**:

- Save: preferred output format, default chunk duration, default mode, theme preference
- Restore on app load
- New "Settings" section in header or export panel
- Files to modify: new `useSettings.ts` hook, `ExportPanel.tsx`, `App.tsx`

### 19. Spectral / Frequency View

**Problem**: Waveform view alone doesn't reveal frequency content. For audio professionals, a spectrogram is essential.

**Approach**:

- Toggle between waveform and spectrogram views
- Use AnalyserNode FFT data rendered to canvas as a heat map
- Overlay cut points and segments on both views
- Files to modify: new `SpectrogramView.tsx`, `WaveformEditor.tsx` (mode toggle)

### 20. Multi-File Support (Batch Processing)

**Problem**: Currently handles one file at a time. Users with many files must process each individually.

**Approach**:

- Allow dropping multiple files
- Show a file list/queue in the sidebar
- Apply same chunk settings to all files
- Batch export with consistent naming: `{filename}_{chunk_001}.mp3`
- Files to modify: `App.tsx` (major refactor), `FileDropZone.tsx`, `types.ts`

---

## Recommended Priority Order

| Priority | Feature                               | Effort    | Impact                               |
| -------- | ------------------------------------- | --------- | ------------------------------------ |
| 🔴 P0    | Undo/Redo (#8)                        | Medium    | Critical UX gap                      |
| 🔴 P0    | Remove/Delete Segments (#1)           | Low       | Core missing feature                 |
| 🟠 P1    | Multi-Select Segments (#2)            | Medium    | Enables power-user workflows         |
| 🟠 P1    | Zoom & Scroll (#9)                    | High      | Essential for long files             |
| 🟠 P1    | Playback Range / Loop (#11)           | Medium    | Auditioning segments is essential    |
| 🟡 P2    | Segment Renaming (#4)                 | Low       | Nice for podcast/interview workflows |
| 🟡 P2    | Fade In/Out (#7)                      | Medium    | Professional audio requirement       |
| 🟡 P2    | Export Options (#5)                   | Low       | Quick win, high usability            |
| 🟡 P2    | Persisted Settings (#18)              | Low       | Quality of life                      |
| 🟡 P2    | Keyboard Shortcuts Overlay (#14)      | Low       | Discoverability                      |
| 🟢 P3    | Silence Detection (#16)               | High      | Killer feature for podcasts          |
| 🟢 P3    | Custom Filenames (#6)                 | Medium    | Polish                               |
| 🟢 P3    | UI Polish (#10, #12, #15)             | Low-Med   | Iterative improvement                |
| 🔵 P4    | Dark/Light Theme (#13)                | Medium    | Nice to have                         |
| 🔵 P4    | Waveform Caching (#17)                | Medium    | Performance for repeat users         |
| 🔵 P4    | Spectral View (#19)                   | High      | Niche / pro audio                    |
| 🔵 P4    | Multi-File Batch (#20)                | Very High | Major scope expansion                |
| 🔵 P4    | Drag Cut Points on Segment Track (#3) | Medium    | Alternative precision input          |

---

## Verification

Each feature should be tested by:

1. **Manual testing**: Load various audio files (short 30s, medium 5min, long 1h+), exercise the new feature
2. **Edge cases**: Empty state, single segment, 100+ segments, very short segments (<0.5s), overlapping boundaries
3. **Mobile**: Touch interactions on iOS Safari and Android Chrome
4. **Export validation**: Verify exported files match expected segments (correct start/end times, no audio glitches, correct format)
5. **Performance**: Waveform rendering should stay smooth (<16ms frame budget) even with 100+ cut points
6. **Build**: `vite build` should pass with no errors after each feature

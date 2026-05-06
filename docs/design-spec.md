# Chunk Audio — Design Spec

## Problem

Long recordings (podcasts, lectures, interviews) are difficult to process in one piece. Transcription pipelines, AI analysis, and manual review all benefit from predictable, smaller segments. Existing tools require uploads to cloud services or desktop software installs.

## Solution

A single-page, in-browser audio splitting tool. Drop a file, choose how to split it (time-based chunks or manual cuts), preview the segments visually, export as a ZIP of individual files. Everything runs locally via WebAssembly — no server, no uploads, no accounts.

## Target Users

- Podcasters prepping episodes for transcription
- Researchers splitting interview recordings
- Audio engineers batch-processing long sessions
- Anyone who needs to break a large audio file into pieces without installing software

## Core Workflows

### 1. Time-based chunking (default)

1. Drop audio file onto the landing page
2. App decodes the file and renders a waveform
3. User selects "Chunk" mode with a target duration (default 10 min)
4. App places evenly-spaced slice lines across the waveform
5. User exports → ffmpeg.wasm splits the file → ZIP downloads

### 2. Manual cutting

1. Drop audio file
2. User selects "Blade" tool and clicks the waveform to place cut points
3. Segments appear below the waveform, color-coded
4. User can reorder segments (drag-and-drop) or disable segments they don't want
5. User exports selected segments → ZIP downloads

### 3. Hybrid preview

- Switch between chunk/manual modes freely
- Playback controls (play, pause, stop, seek) work in both modes
- Multi-select segments (click, Shift+click range, Ctrl/Cmd+click toggle, Ctrl+A all) for export-only-selected and bulk delete
- Undo/redo (Ctrl+Z, Ctrl+Shift+Z) for cuts, segment toggles, reorders, and deletes
- Keyboard shortcuts: `Space` play/pause, `V` select tool, `B` blade tool, `Delete` removes selected segments or last cut, `Esc` clears selection / loop range

## Architecture

### Stack

| Layer          | Technology                                     |
| -------------- | ---------------------------------------------- |
| Framework      | React 18 + TypeScript                          |
| Build          | Vite 8                                         |
| Styling        | Tailwind CSS v4                                |
| Audio decode   | Web Audio API (`AudioContext.decodeAudioData`) |
| Audio split    | ffmpeg.wasm v0.11 (single-threaded)            |
| ZIP generation | JSZip                                          |
| Download       | file-saver                                     |
| Drag-and-drop  | dnd-kit                                        |
| Icons          | lucide-react                                   |
| UI primitives  | base-ui + shadcn                               |

### Data flow

```
File drop → Web Audio API decode → AudioBuffer + waveform data
                                        ↓
                               WaveformEditor (canvas)
                                        ↓
                          CutPoints / ChunkLines → Segments
                                        ↓
                          ffmpeg.wasm (virtual FS) → split files
                                        ↓
                          JSZip → Blob → saveAs → download
```

### Key modules

| Module                          | Responsibility                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| `App.tsx`                       | Root orchestrator — mode switching, keyboard shortcuts, export pipeline                          |
| `hooks/useFFmpeg.ts`            | ffmpeg.wasm lifecycle — load, run commands, virtual FS I/O                                       |
| `hooks/useAudioDecoder.ts`      | Decode uploaded file into AudioBuffer + Float32Array waveform peaks                              |
| `hooks/useAudioEditor.ts`       | Playback state, cut points, segments, tool selection, seek/play/pause                            |
| `components/WaveformEditor.tsx` | Canvas rendering of waveform, cut markers, chunk lines, playback cursor                          |
| `components/SegmentTrack.tsx`   | Draggable segment cards with enable/disable toggles                                              |
| `components/ExportPanel.tsx`    | Format picker, chunk duration slider, export button, progress bar                                |
| `utils/audioProcessing.ts`      | `chunkByTime()` and `extractSegments()` — ffmpeg command orchestration                           |
| `utils/waveform.ts`             | Waveform peak extraction for canvas rendering                                                    |
| `types.ts`                      | Shared types: `AudioFile`, `CutPoint`, `Segment`, `EditorMode`, `ExportOptions`, `PlaybackState` |

### Browser requirements

- SharedArrayBuffer support → requires COOP/COEP headers
- Web Audio API
- ~50MB memory for ffmpeg.wasm runtime

Vite dev server sets required headers in `vite.config.ts`. Production deploys (Netlify) set them via `public/_headers`.

## UI Layout

### Landing page (no file loaded)

```
┌─────────────────────────────────────────┐
│  Header (logo, tagline)                 │
├─────────────────────────────────────────┤
│                                         │
│  "Split, edit, and export audio         │
│   — privately"                          │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Drag & drop or click to       │    │
│  │   select an audio file          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Blade tool] [Private] [Export]        │
│  Feature cards                          │
└─────────────────────────────────────────┘
```

### Editor (file loaded)

```
┌─────────────────────────────────────────┐
│  Header                                 │
├─────────────────────────────────────────┤
│  filename.mp3 │ 12m 34s │ 8.2MB │ 44.1kHz  [Chunk|Manual] [Select|Blade]
│  ──│────│────│────│────│────│────│── Timeline ruler
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Waveform + markers
│  ◀ ▶ ■  00:00 / 12:34                   Transport controls
├─────────────────────────────────────────┤
│  [Seg 1 ▓▓▓] [Seg 2 ▓▓▓] [Seg 3 ▓▓▓]  Segment track (reorderable)
├─────────────────────────────────────────┤
│  Duration: [────●──────] 600s           Export panel
│  Format: [MP3 ▾]                        │
│  [Export ZIP] ███████░░░ 70%            │
└─────────────────────────────────────────┘
```

## Export Pipeline

1. Write uploaded file to ffmpeg virtual filesystem
2. If chunk mode: convert to target format, then `-f segment -segment_time N`
3. If manual mode: for each enabled segment, `-ss START -to END -c copy`
4. Collect output files from virtual FS
5. Bundle into ZIP via JSZip
6. Trigger download via `file-saver`

Supported output formats: MP3, WAV, OGG.

## Privacy Model

- Zero server component — all processing in-browser via WebAssembly
- Files are decoded and split entirely in memory
- No telemetry, no analytics, no cookies
- Virtual filesystem is cleaned up after each export

## Deployment

- Static build deployed to Netlify
- `netlify.toml` runs `vite build`, publishes `dist/`
- `public/_headers` sets COOP/COEP for SharedArrayBuffer support
- No backend, no functions, no database

## Limitations

- ffmpeg.wasm single-threaded — large files (>2h) may be slow
- SharedArrayBuffer requires specific headers; some hosting platforms may not support
- No waveform persistence — reloading the page requires re-dropping the file
- Manual-mode segment export re-encodes via ffmpeg (codec chosen per output format) so cuts are sample-accurate

## Future considerations

- Web Worker for ffmpeg to avoid blocking UI thread
- Multi-threaded ffmpeg.wasm for faster processing
- Persisted settings (preferred format, default chunk duration) via localStorage
- Waveform caching in IndexedDB for faster re-loads
- Spectral view alongside waveform

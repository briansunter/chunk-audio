# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `bun install` — install dependencies
- `bun run dev` — start Vite dev server
- `bun run build` — production build (output to `dist/`)
- `bun run preview` — preview production build locally

No test framework is configured.

## Architecture

Single-page React + TypeScript app that splits audio files into 10-minute MP3 chunks and downloads them as a ZIP.

**Core pipeline** (all in `src/App.tsx`):
1. User selects an audio file via `<input type="file">`
2. `@ffmpeg/ffmpeg` (ffmpeg.wasm v0.11) loads in-browser — requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers (set in `vite.config.ts` for dev, `public/_headers` for Netlify)
3. File is written to ffmpeg's virtual filesystem, converted to MP3, then split into 600-second segments via ffmpeg's `-f segment` format
4. Chunks are collected from the virtual FS, bundled into a ZIP via `jszip`, and downloaded via `file-saver`

**Key dependencies:**
- `@ffmpeg/ffmpeg` + `@ffmpeg/core` v0.11 — WASM ffmpeg in the browser (uses the older single-threaded API with `createFFmpeg`)
- `jszip` — ZIP generation
- `file-saver` — triggers browser download
- `react` 18, `vite` 8 with `@vitejs/plugin-react`

**Deployment:** Netlify (`netlify.toml` runs `vite build`, publishes `dist/`)

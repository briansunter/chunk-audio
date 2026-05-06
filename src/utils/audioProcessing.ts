import type { Segment } from "../types";

type OutputFormat = "mp3" | "wav" | "ogg";

interface FormatProfile {
	ext: OutputFormat;
	codecArgs: string[];
}

function profileFor(format: string): FormatProfile {
	switch (format) {
		case "wav":
			return { ext: "wav", codecArgs: ["-codec:a", "pcm_s16le"] };
		case "ogg":
			return {
				ext: "ogg",
				codecArgs: ["-codec:a", "libvorbis", "-qscale:a", "5"],
			};
		case "mp3":
		default:
			return {
				ext: "mp3",
				codecArgs: ["-codec:a", "libmp3lame", "-qscale:a", "2"],
			};
	}
}

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
	const { ext, codecArgs } = profileFor(outputFormat);
	const outputPattern = `chunk_%03d.${ext}`;
	const tempName = `temp_converted.${ext}`;

	await ffmpeg.runCommand("-i", inputName, ...codecArgs, tempName);
	await ffmpeg.runCommand(
		"-i",
		tempName,
		"-f",
		"segment",
		"-segment_time",
		String(chunkDuration),
		"-c",
		"copy",
		outputPattern,
	);

	const allFiles = ffmpeg.readdir("/");
	const chunkFiles = allFiles.filter((f) => f.startsWith("chunk_"));

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
	const { ext, codecArgs } = profileFor(outputFormat);
	const results: { name: string; data: Uint8Array }[] = [];

	for (let i = 0; i < segments.length; i++) {
		const seg = segments[i];
		const segName = seg.customName
			? `${String(i + 1).padStart(2, "0")}_${seg.customName.replace(/[^a-zA-Z0-9_-]/g, "_")}`
			: `seg_${String(i + 1).padStart(3, "0")}`;
		const outputName = `${segName}.${ext}`;
		const startTime = formatFfmpegTime(seg.startTime);
		const endTime = formatFfmpegTime(seg.endTime);

		await ffmpeg.runCommand(
			"-i",
			inputName,
			"-ss",
			startTime,
			"-to",
			endTime,
			...codecArgs,
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
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.padStart(6, "0")}`;
}

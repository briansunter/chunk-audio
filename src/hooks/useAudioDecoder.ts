import { useCallback, useState } from "react";
import type { AudioFile } from "../types";

const PEAKS_COUNT = 4000;

export function useAudioDecoder() {
	const [isDecoding, setIsDecoding] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const decodeFile = useCallback(async (file: File): Promise<AudioFile> => {
		setIsDecoding(true);
		setError(null);
		try {
			const arrayBuffer = await file.arrayBuffer();
			const audioContext = new AudioContext();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
			const waveformData = extractPeaks(audioBuffer, PEAKS_COUNT);

			return {
				file,
				name: file.name,
				duration: audioBuffer.duration,
				arrayBuffer,
				waveformData,
				audioBuffer,
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to decode audio";
			setError(msg);
			throw err;
		} finally {
			setIsDecoding(false);
		}
	}, []);

	return { isDecoding, error, decodeFile };
}

function extractPeaks(audioBuffer: AudioBuffer, samples: number): Float32Array {
	const channel = audioBuffer.getChannelData(0);
	const step = Math.floor(channel.length / samples);
	const peaks = new Float32Array(samples * 2);

	for (let i = 0; i < samples; i++) {
		let min = 1.0;
		let max = -1.0;
		const start = i * step;
		const end = Math.min(start + step, channel.length);
		for (let j = start; j < end; j++) {
			const val = channel[j];
			if (val < min) min = val;
			if (val > max) max = val;
		}
		peaks[i * 2] = min;
		peaks[i * 2 + 1] = max;
	}

	return peaks;
}

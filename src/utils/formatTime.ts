export function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	const ms = Math.floor((seconds % 1) * 1000);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function formatTimeShort(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function parseTimeInput(input: string): number {
	const parts = input.split(":");
	if (parts.length === 2) {
		return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
	}
	if (parts.length === 3) {
		return (
			parseInt(parts[0], 10) * 3600 +
			parseInt(parts[1], 10) * 60 +
			parseFloat(parts[2])
		);
	}
	return parseFloat(input) || 0;
}

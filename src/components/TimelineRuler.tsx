import { useEffect, useRef, useState } from "react";

interface Props {
	duration: number;
}

export default function TimelineRuler({ duration }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [w, setW] = useState(0);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setW(Math.floor(entry.contentRect.width));
			}
		});
		observer.observe(container);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || w === 0) return;

		const dpr = window.devicePixelRatio || 1;
		const h = 22;
		canvas.width = w * dpr;
		canvas.height = h * dpr;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.scale(dpr, dpr);

		ctx.fillStyle = "#111119";
		ctx.fillRect(0, 0, w, h);

		let interval: number;
		if (duration < 60) interval = 5;
		else if (duration < 300) interval = 10;
		else if (duration < 1800) interval = 30;
		else if (duration < 7200) interval = 60;
		else interval = 300;

		ctx.strokeStyle = "#2a2a3a";
		ctx.fillStyle = "#6b6b80";
		ctx.font = "10px 'JetBrains Mono', monospace";
		ctx.textAlign = "center";

		for (let t = 0; t <= duration; t += interval) {
			const x = (t / duration) * w;
			ctx.beginPath();
			ctx.moveTo(x, h - 6);
			ctx.lineTo(x, h);
			ctx.stroke();

			if (t > 0) {
				ctx.fillText(formatTime(t), x, h - 8);
			}
		}
	}, [w, duration]);

	return (
		<div ref={containerRef} className="w-full h-[22px] shrink-0">
			<canvas ref={canvasRef} style={{ width: w, height: 22 }} />
		</div>
	);
}

function formatTime(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	if (m > 0) return `${m}:${String(s).padStart(2, "0")}`;
	return `${s}s`;
}

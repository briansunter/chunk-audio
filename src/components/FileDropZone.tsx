import { useCallback, useState } from "react";

interface Props {
	onFileSelected: (file: File) => void;
	disabled?: boolean;
}

export default function FileDropZone({ onFileSelected, disabled }: Props) {
	const [isDragging, setIsDragging] = useState(false);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			e.stopPropagation();
			setIsDragging(false);
			const file = e.dataTransfer.files[0];
			if (file?.type.startsWith("audio/")) {
				onFileSelected(file);
			}
		},
		[onFileSelected],
	);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) onFileSelected(file);
		},
		[onFileSelected],
	);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: drag/drop zone — keyboard accessibility is provided by the <label>+<input type="file"> below.
		<div
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
			className={`flex items-center justify-center ${disabled ? "opacity-50 pointer-events-none" : ""}`}
		>
			<label
				className={`
          relative flex flex-col items-center justify-center w-full max-w-2xl
          min-h-[200px] rounded-2xl cursor-pointer border border-dashed
          transition-all duration-300 px-8 py-10
          ${
						isDragging
							? "border-accent-green bg-accent-green/5 scale-[1.01]"
							: "border-border-soft hover:border-accent-green/40 hover:bg-white/[0.02]"
					}
        `}
			>
				<input
					type="file"
					accept="audio/*"
					onChange={handleChange}
					className="absolute inset-0 opacity-0 cursor-pointer"
					disabled={disabled}
				/>
				<div
					className={`mb-3 transition-colors ${isDragging ? "text-accent-green" : "text-text-muted"}`}
				>
					<svg
						width="32"
						height="32"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
						<polyline points="17 8 12 3 7 8" />
						<line x1="12" y1="3" x2="12" y2="15" />
					</svg>
				</div>
				<p
					className={`text-sm font-medium transition-colors ${isDragging ? "text-accent-green" : "text-text-secondary"}`}
				>
					{isDragging
						? "Release to load"
						: "Drop audio file or click to browse"}
				</p>
				<p className="text-xs text-text-muted mt-1.5">
					MP3, WAV, OGG, FLAC, M4A, AAC
				</p>
			</label>
		</div>
	);
}

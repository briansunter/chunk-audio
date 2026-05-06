import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { EditorMode, ExportOptions } from "../types";

const CHUNK_PRESETS = [
	{ label: "30s", value: 30 },
	{ label: "1m", value: 60 },
	{ label: "5m", value: 300 },
	{ label: "10m", value: 600 },
	{ label: "15m", value: 900 },
	{ label: "30m", value: 1800 },
];

interface Props {
	mode: EditorMode;
	chunkDuration: number;
	onChunkDurationChange: (dur: number) => void;
	isProcessing: boolean;
	progress: number;
	hasSelection: boolean;
	selectedCount: number;
	onExport: (options: ExportOptions) => void;
}

export default function ExportPanel({
	mode,
	chunkDuration,
	onChunkDurationChange,
	isProcessing,
	progress,
	hasSelection,
	selectedCount,
	onExport,
}: Props) {
	const [outputFormat, setOutputFormat] = useState<"mp3" | "wav" | "ogg">(
		"mp3",
	);

	const handleExportAll = () => {
		onExport({ mode, chunkDuration, outputFormat });
	};

	const handleExportSelected = () => {
		onExport({ mode, chunkDuration, outputFormat, selectedOnly: true });
	};

	return (
		<div className="flex items-center gap-3 px-4 py-3 max-[640px]:flex-wrap max-[640px]:gap-2 max-[640px]:py-3">
			<Badge variant="outline" className="font-mono text-xs uppercase">
				{mode === "chunk" ? "Chunk" : "Manual"}
			</Badge>

			{mode === "chunk" && (
				<>
					<Separator
						orientation="vertical"
						className="h-6 max-[640px]:hidden"
					/>
					<div className="flex items-center gap-1.5 max-[640px]:flex-wrap">
						{CHUNK_PRESETS.map((p) => (
							<Button
								key={p.value}
								variant={chunkDuration === p.value ? "default" : "ghost"}
								size="sm"
								className="font-mono text-xs max-[640px]:min-w-[44px]"
								onClick={() => onChunkDurationChange(p.value)}
							>
								{p.label}
							</Button>
						))}
						<Input
							type="number"
							min={1}
							max={3600}
							value={chunkDuration}
							onChange={(e) => onChunkDurationChange(Number(e.target.value))}
							className="w-16 h-7 px-2 text-xs text-center font-mono max-[640px]:h-[44px] max-[640px]:w-20"
						/>
						<span className="text-xs text-muted-foreground">sec</span>
					</div>
				</>
			)}

			<Separator orientation="vertical" className="h-6 max-[640px]:hidden" />

			<Select
				value={outputFormat}
				onValueChange={(v) => setOutputFormat(v as "mp3" | "wav" | "ogg")}
			>
				<SelectTrigger
					size="sm"
					className="h-7 w-[80px] text-xs font-mono max-[640px]:h-[44px] max-[640px]:w-[110px]"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="mp3" className="text-xs font-mono">
						MP3
					</SelectItem>
					<SelectItem value="wav" className="text-xs font-mono">
						WAV
					</SelectItem>
					<SelectItem value="ogg" className="text-xs font-mono">
						OGG
					</SelectItem>
				</SelectContent>
			</Select>

			{isProcessing && (
				<div className="flex items-center gap-2">
					<div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
						<div
							className="h-full bg-primary rounded-full transition-all"
							style={{ width: `${progress * 100}%` }}
						/>
					</div>
					<span className="text-xs text-muted-foreground font-mono">
						{Math.round(progress * 100)}%
					</span>
				</div>
			)}

			<div className="flex-1" />

			{hasSelection && (
				<Button
					size="sm"
					variant="outline"
					onClick={handleExportSelected}
					disabled={isProcessing}
					className="font-mono text-xs"
					title={`Export ${selectedCount} selected segment${selectedCount > 1 ? "s" : ""}`}
				>
					Export ({selectedCount})
				</Button>
			)}

			<Button
				size="default"
				onClick={handleExportAll}
				disabled={isProcessing}
				className="font-mono text-sm"
			>
				{isProcessing ? "Processing..." : "Export ZIP"}
			</Button>
		</div>
	);
}

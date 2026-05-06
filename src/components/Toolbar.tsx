import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { EditorTool, EditorMode } from "../types";

interface Props {
	activeTool: EditorTool;
	mode: EditorMode;
	canUndo: boolean;
	canRedo: boolean;
	onToolChange: (tool: EditorTool) => void;
	onModeChange: (mode: EditorMode) => void;
	onUndo: () => void;
	onRedo: () => void;
}

export default function Toolbar({
	activeTool,
	mode,
	canUndo,
	canRedo,
	onToolChange,
	onModeChange,
	onUndo,
	onRedo,
}: Props) {
	return (
		<div className="flex items-center gap-2 flex-wrap max-[640px]:gap-1.5">
			{/* Undo / Redo */}
			<div className="flex items-center gap-0.5">
				<Button
					variant="ghost"
					size="icon"
					onClick={onUndo}
					disabled={!canUndo}
					title="Undo (Ctrl+Z)"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M3 7v6h6" />
						<path d="M3 13a9 9 0 0 1 15.36-6.36L21 9" />
					</svg>
				</Button>
				<Button
					variant="ghost"
					size="icon"
					onClick={onRedo}
					disabled={!canRedo}
					title="Redo (Ctrl+Shift+Z)"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M21 7v6h-6" />
						<path d="M21 13a9 9 0 0 0-15.36-6.36L3 9" />
					</svg>
				</Button>
			</div>

			<Separator orientation="vertical" className="h-6 max-[640px]:hidden" />

			<ToggleGroup
				value={[activeTool]}
				onValueChange={(v) => {
					if (v.length > 0) onToolChange(v[0] as EditorTool);
				}}
				variant="outline"
				size="sm"
			>
				<ToggleGroupItem value="select" title="Select / Seek (V)">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M4 4l7 17 2.5-7.5L21 11z" />
					</svg>
				</ToggleGroupItem>
				<ToggleGroupItem value="blade" title="Blade / Cut (B)">
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M6 2l4 4-6 6 4 4 6-6 4 4" />
						<line x1="18" y1="2" x2="22" y2="6" />
					</svg>
				</ToggleGroupItem>
			</ToggleGroup>

			<Separator orientation="vertical" className="h-6 max-[640px]:hidden" />

			<ToggleGroup
				value={[mode]}
				onValueChange={(v) => {
					if (v.length > 0) onModeChange(v[0] as EditorMode);
				}}
				variant="outline"
				size="sm"
			>
				<ToggleGroupItem value="chunk" className="text-xs font-mono px-3">
					Chunk
				</ToggleGroupItem>
				<ToggleGroupItem value="manual" className="text-xs font-mono px-3">
					Manual
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}

import { useState, useRef, useEffect } from "react";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	horizontalListSortingStrategy,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Segment } from "../types";
import { formatTimeShort } from "../utils/formatTime";

interface Props {
	segments: Segment[];
	segmentOrder: string[];
	selectedSegmentIds: Set<string>;
	onReorder?: (newOrder: string[]) => void;
	onToggleEnabled?: (id: string) => void;
	onDeleteSegment?: (id: string) => void;
	onToggleSelection?: (id: string, exclusive?: boolean) => void;
	onSelectRange?: (id: string) => void;
	onPlaySegment?: (id: string) => void;
	onRenameSegment?: (id: string, name: string) => void;
}

export default function SegmentTrack({
	segments,
	segmentOrder,
	selectedSegmentIds,
	onReorder,
	onToggleEnabled,
	onDeleteSegment,
	onToggleSelection,
	onSelectRange,
	onPlaySegment,
	onRenameSegment,
}: Props) {
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 200, tolerance: 8 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const orderedSegments = segmentOrder
		.map((id) => segments.find((s) => s.id === id))
		.filter((s): s is Segment => !!s);

	const totalDuration = segments.reduce(
		(sum, s) => sum + (s.endTime - s.startTime),
		0,
	);
	const interactive = !!onReorder && !!onToggleEnabled;
	const hasSelection = selectedSegmentIds.size > 0;

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		if (!over || active.id === over.id || !onReorder) return;

		const oldIndex = segmentOrder.indexOf(String(active.id));
		const newIndex = segmentOrder.indexOf(String(over.id));
		if (oldIndex === -1 || newIndex === -1) return;

		const newOrder = [...segmentOrder];
		const [moved] = newOrder.splice(oldIndex, 1);
		newOrder.splice(newIndex, 0, moved);
		onReorder(newOrder);
	}

	// On mobile (< 640px), use vertical list so cards are full-width and easy to tap.
	// On desktop, use horizontal scroll chips.
	// Root is a flex column with min-h-0 so the inner scroll regions cap inside
	// the parent card's max-height, instead of pushing the waveform up.
	return (
		<div className="flex flex-col min-h-0 h-full">
			<div className="flex items-center gap-2 px-3 pt-2.5 pb-0 sm:px-3 shrink-0">
				<div className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
					Segments · {orderedSegments.length}
					{!interactive && (
						<span className="ml-2 text-muted-foreground/60">auto-chunked</span>
					)}
				</div>
				{hasSelection && (
					<span className="text-xs text-primary font-mono">
						{selectedSegmentIds.size} selected
					</span>
				)}
			</div>

			{/* Mobile: vertical full-width list. Fills the card's available height
			   (capped by the parent in App.tsx) and scrolls within. */}
			<div className="flex flex-col gap-2 p-3 sm:hidden flex-1 min-h-0 overflow-y-auto overscroll-contain">
				{orderedSegments.map((seg) => (
					<SegmentCardMobile
						key={seg.id}
						segment={seg}
						interactive={interactive}
						canDelete={!!onDeleteSegment && segments.length > 1}
						isSelected={selectedSegmentIds.has(seg.id)}
						onToggle={
							onToggleEnabled ? () => onToggleEnabled(seg.id) : undefined
						}
						onDelete={
							onDeleteSegment ? () => onDeleteSegment(seg.id) : undefined
						}
						onSelect={
							onToggleSelection
								? (ex) => onToggleSelection(seg.id, ex)
								: undefined
						}
						onPlay={onPlaySegment ? () => onPlaySegment(seg.id) : undefined}
						onRename={
							onRenameSegment
								? (name) => onRenameSegment(seg.id, name)
								: undefined
						}
					/>
				))}
			</div>

			{/* Desktop: horizontal scroll */}
			{interactive ? (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={segmentOrder}
						strategy={horizontalListSortingStrategy}
					>
						<div className="hidden sm:flex gap-2 overflow-x-auto pb-1 px-3 py-3">
							{orderedSegments.map((seg) => (
								<SegmentCardDesktop
									key={seg.id}
									segment={seg}
									totalDuration={totalDuration}
									interactive={interactive}
									canDelete={!!onDeleteSegment && segments.length > 1}
									isSelected={selectedSegmentIds.has(seg.id)}
									onToggle={
										onToggleEnabled ? () => onToggleEnabled(seg.id) : undefined
									}
									onDelete={
										onDeleteSegment ? () => onDeleteSegment(seg.id) : undefined
									}
									onSelect={
										onToggleSelection
											? (ex) => onToggleSelection(seg.id, ex)
											: undefined
									}
									onSelectRange={
										onSelectRange ? () => onSelectRange(seg.id) : undefined
									}
									onPlay={
										onPlaySegment ? () => onPlaySegment(seg.id) : undefined
									}
									onRename={
										onRenameSegment
											? (name) => onRenameSegment(seg.id, name)
											: undefined
									}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
			) : (
				<div className="hidden sm:flex gap-2 overflow-x-auto pb-1 px-3 py-3">
					{orderedSegments.map((seg) => (
						<SegmentCardDesktop
							key={seg.id}
							segment={seg}
							totalDuration={totalDuration}
							interactive={false}
							canDelete={false}
							isSelected={false}
						/>
					))}
				</div>
			)}
		</div>
	);
}

/* ──────────────────────────────────────────────────────────
   Mobile card — full width, big touch targets, clear actions
   ────────────────────────────────────────────────────────── */

function SegmentCardMobile({
	segment,
	interactive,
	canDelete,
	isSelected,
	onToggle,
	onDelete,
	onSelect,
	onPlay,
	onRename,
}: {
	segment: Segment;
	interactive: boolean;
	canDelete: boolean;
	isSelected: boolean;
	onToggle?: () => void;
	onDelete?: () => void;
	onSelect?: (exclusive: boolean) => void;
	onPlay?: () => void;
	onRename?: (name: string) => void;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (deleteTimerRef.current) {
				clearTimeout(deleteTimerRef.current);
				deleteTimerRef.current = null;
			}
		};
	}, []);

	const duration = segment.endTime - segment.startTime;
	const displayName = segment.customName || segment.label;

	const handleTap = () => {
		if (isEditing) return;
		onSelect?.(true);
	};

	const handleDoubleClick = () => {
		if (onRename && interactive) {
			setEditValue(segment.customName || "");
			setIsEditing(true);
			setTimeout(() => inputRef.current?.focus(), 0);
		} else if (onPlay) {
			onPlay();
		}
	};

	const finishEditing = () => {
		setIsEditing(false);
		if (onRename && editValue.trim()) onRename(editValue.trim());
	};

	const handleDelete = () => {
		if (confirmDelete) {
			// Second tap — actually delete
			if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
			setConfirmDelete(false);
			onDelete?.();
		} else {
			// First tap — show confirmation
			setConfirmDelete(true);
			deleteTimerRef.current = setTimeout(() => setConfirmDelete(false), 2500);
		}
	};

	return (
		<div
			onClick={handleTap}
			onDoubleClick={handleDoubleClick}
			className={`
        flex items-center gap-3 rounded-xl border px-4 py-3 w-full
        select-none transition-all min-h-[56px]
        ${isSelected ? "ring-2 ring-primary/70 shadow-sm shadow-primary/20" : ""}
        ${
					segment.enabled
						? "border-border bg-secondary/50 active:bg-secondary/80"
						: "border-border bg-background opacity-50"
				}
      `}
		>
			{/* Color dot */}
			<div
				className="w-5 h-5 rounded-full shrink-0"
				style={{
					backgroundColor: segment.enabled
						? segment.color
						: "var(--muted-foreground)",
				}}
			/>

			{/* Name + duration */}
			<div className="flex flex-col min-w-0 flex-1">
				{isEditing ? (
					<input
						ref={inputRef}
						type="text"
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onBlur={finishEditing}
						onKeyDown={(e) => {
							if (e.key === "Enter") finishEditing();
							else if (e.key === "Escape") setIsEditing(false);
							e.stopPropagation();
						}}
						placeholder={segment.label}
						className="text-sm bg-background border border-primary/40 rounded px-2 py-1 outline-none w-full"
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
					<span className="text-sm font-medium text-foreground/80 leading-tight truncate">
						{displayName}
					</span>
				)}
				<span className="text-xs font-mono text-muted-foreground leading-tight mt-0.5">
					{formatTimeShort(duration)}
				</span>
			</div>

			{/* Big action buttons */}
			{interactive && (
				<div className="flex items-center gap-2 shrink-0">
					{onToggle && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								onToggle();
							}}
							className={`
                min-w-[44px] min-h-[44px] flex items-center justify-center
                rounded-lg text-sm font-mono font-semibold
                transition-colors
                ${
									segment.enabled
										? "text-primary bg-primary/10 active:bg-primary/20"
										: "text-muted-foreground bg-muted active:bg-muted/80"
								}
              `}
						>
							{segment.enabled ? "ON" : "OFF"}
						</button>
					)}
					{canDelete && onDelete && (
						<button
							onClick={(e) => {
								e.stopPropagation();
								handleDelete();
							}}
							className={`
                min-w-[44px] min-h-[44px] flex items-center justify-center
                rounded-lg text-sm font-medium transition-colors
                ${
									confirmDelete
										? "text-white bg-destructive active:bg-destructive/80"
										: "text-muted-foreground bg-muted hover:text-destructive active:bg-destructive/20"
								}
              `}
						>
							{confirmDelete ? "✓" : "🗑"}
						</button>
					)}
				</div>
			)}
		</div>
	);
}

/* ──────────────────────────────────────────────────────────
   Desktop card — horizontal chip layout
   ────────────────────────────────────────────────────────── */

function SegmentCardDesktop({
	segment,
	totalDuration,
	interactive,
	canDelete,
	isSelected,
	onToggle,
	onDelete,
	onSelect,
	onSelectRange,
	onPlay,
	onRename,
}: {
	segment: Segment;
	totalDuration: number;
	interactive: boolean;
	canDelete: boolean;
	isSelected: boolean;
	onToggle?: () => void;
	onDelete?: () => void;
	onSelect?: (exclusive: boolean) => void;
	onSelectRange?: () => void;
	onPlay?: () => void;
	onRename?: (name: string) => void;
}) {
	const sortable = useSortable({ id: segment.id, disabled: !interactive });
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = sortable;

	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const style = interactive
		? {
				transform: CSS.Transform.toString(transform),
				transition,
				opacity: isDragging ? 0.5 : 1,
			}
		: {};

	const duration = segment.endTime - segment.startTime;
	const widthPercent = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;
	const displayName = segment.customName || segment.label;

	const handleClick = (e: React.MouseEvent) => {
		if (isEditing) return;
		if (!onSelect) return;
		if (e.shiftKey && onSelectRange) onSelectRange();
		else if (e.ctrlKey || e.metaKey) onSelect(false);
		else onSelect(true);
	};

	const handleDoubleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (onRename && interactive) {
			setEditValue(segment.customName || "");
			setIsEditing(true);
			setTimeout(() => inputRef.current?.focus(), 0);
		} else if (onPlay) {
			onPlay();
		}
	};

	const finishEditing = () => {
		setIsEditing(false);
		if (onRename && editValue.trim()) onRename(editValue.trim());
	};

	return (
		<div
			ref={interactive ? setNodeRef : undefined}
			style={style}
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
			className={`
        flex items-center gap-3 rounded-xl border px-4 py-3
        min-w-[140px] shrink-0 select-none transition-all
        ${interactive ? "cursor-grab active:cursor-grabbing" : ""}
        ${isSelected ? "ring-2 ring-primary/70 shadow-sm shadow-primary/20" : ""}
        ${
					segment.enabled
						? "border-border bg-secondary/50 hover:bg-secondary/70"
						: "border-border bg-background opacity-50"
				}
      `}
			{...(interactive ? { ...attributes, ...listeners } : {})}
		>
			<div
				className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-card"
				style={
					{
						backgroundColor: segment.enabled
							? segment.color
							: "var(--muted-foreground)",
						"--tw-ring-color": segment.enabled
							? `${segment.color}40`
							: "transparent",
					} as React.CSSProperties
				}
			/>

			<div className="flex flex-col min-w-0 gap-1">
				{isEditing ? (
					<input
						ref={inputRef}
						type="text"
						value={editValue}
						onChange={(e) => setEditValue(e.target.value)}
						onBlur={finishEditing}
						onKeyDown={(e) => {
							if (e.key === "Enter") finishEditing();
							else if (e.key === "Escape") setIsEditing(false);
							e.stopPropagation();
						}}
						placeholder={segment.label}
						className="text-sm bg-background border border-primary/40 rounded px-1.5 py-0.5 outline-none w-full min-w-[80px]"
						onClick={(e) => e.stopPropagation()}
					/>
				) : (
					<span
						className="text-sm font-medium text-foreground/80 leading-tight truncate max-w-[120px]"
						title={displayName}
					>
						{displayName}
					</span>
				)}
				<span className="text-xs font-mono text-muted-foreground leading-tight">
					{formatTimeShort(duration)}
				</span>
				<div
					className="h-1.5 rounded-full mt-0.5"
					style={{
						width: `${Math.max(30, Math.min(80, widthPercent * 2.5))}px`,
						backgroundColor: segment.enabled
							? `${segment.color}40`
							: "var(--muted)",
					}}
				/>
			</div>

			<div className="flex flex-col items-center gap-1 ml-auto shrink-0">
				{interactive && onToggle && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onToggle();
						}}
						className={`text-[11px] font-mono font-semibold px-2 py-1 rounded-md cursor-pointer transition-colors
							${segment.enabled ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}
					>
						{segment.enabled ? "ON" : "OFF"}
					</button>
				)}
				{canDelete && onDelete && (
					<button
						onClick={(e) => {
							e.stopPropagation();
							onDelete();
						}}
						title="Delete segment"
						className="text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 px-2 py-1 rounded-md cursor-pointer transition-colors leading-none"
					>
						×
					</button>
				)}
			</div>
		</div>
	);
}

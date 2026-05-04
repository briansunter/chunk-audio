import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Segment } from '../types';
import { formatTimeShort } from '../utils/formatTime';

interface Props {
  segments: Segment[];
  segmentOrder: string[];
  onReorder?: (newOrder: string[]) => void;
  onToggleEnabled?: (id: string) => void;
}

export default function SegmentTrack({
  segments,
  segmentOrder,
  onReorder,
  onToggleEnabled,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const orderedSegments = segmentOrder
    .map(id => segments.find(s => s.id === id))
    .filter((s): s is Segment => !!s);

  const totalDuration = segments.reduce((sum, s) => sum + (s.endTime - s.startTime), 0);
  const interactive = !!onReorder && !!onToggleEnabled;

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

  const content = (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5">
      {orderedSegments.map(seg => (
        <SegmentCard
          key={seg.id}
          segment={seg}
          totalDuration={totalDuration}
          interactive={interactive}
          onToggle={onToggleEnabled ? () => onToggleEnabled(seg.id) : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="px-3 py-2.5">
      <div className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-widest">
        Segments · {orderedSegments.length}
        {!interactive && <span className="ml-2 text-muted-foreground/60">auto-chunked</span>}
      </div>
      {interactive ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={segmentOrder} strategy={horizontalListSortingStrategy}>
            {content}
          </SortableContext>
        </DndContext>
      ) : (
        content
      )}
    </div>
  );
}

function SegmentCard({
  segment,
  totalDuration,
  interactive,
  onToggle,
}: {
  segment: Segment;
  totalDuration: number;
  interactive: boolean;
  onToggle?: () => void;
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

  const style = interactive ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  } : {};

  const duration = segment.endTime - segment.startTime;
  const widthPercent = totalDuration > 0 ? (duration / totalDuration) * 100 : 0;

  return (
    <div
      ref={interactive ? setNodeRef : undefined}
      style={style}
      className={`
        flex items-center gap-2 rounded-lg border px-2 py-1.5
        min-w-[90px] shrink-0 select-none transition-opacity
        ${interactive ? 'cursor-grab active:cursor-grabbing' : ''}
        ${segment.enabled
          ? 'border-border bg-secondary/50'
          : 'border-border bg-background opacity-50'
        }
      `}
      {...(interactive ? { ...attributes, ...listeners } : {})}
    >
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: segment.enabled ? segment.color : 'var(--muted-foreground)' }}
      />
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-mono text-muted-foreground leading-tight">
          {formatTimeShort(duration)}
        </span>
        <div
          className="h-1 rounded-full mt-1"
          style={{
            width: `${Math.max(20, Math.min(60, widthPercent * 2))}px`,
            backgroundColor: segment.enabled ? `${segment.color}30` : 'var(--muted)',
          }}
        />
      </div>
      {interactive && onToggle && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`
            text-[8px] font-mono px-1 py-0.5 rounded cursor-pointer ml-auto
            transition-colors shrink-0
            ${segment.enabled
              ? 'text-primary hover:bg-primary/10'
              : 'text-muted-foreground hover:bg-muted'
            }
          `}
        >
          {segment.enabled ? 'ON' : 'OFF'}
        </button>
      )}
    </div>
  );
}

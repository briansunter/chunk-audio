import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';
import type { EditorTool, EditorMode } from '../types';

interface Props {
  activeTool: EditorTool;
  mode: EditorMode;
  onToolChange: (tool: EditorTool) => void;
  onModeChange: (mode: EditorMode) => void;
}

export default function Toolbar({ activeTool, mode, onToolChange, onModeChange }: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap max-[640px]:gap-1.5">
      <ToggleGroup
        value={[activeTool]}
        onValueChange={(v) => { if (v.length > 0) onToolChange(v[0] as EditorTool); }}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="select" title="Select / Seek (V)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4l7 17 2.5-7.5L21 11z" />
          </svg>
        </ToggleGroupItem>
        <ToggleGroupItem value="blade" title="Blade / Cut (B)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2l4 4-6 6 4 4 6-6 4 4" />
            <line x1="18" y1="2" x2="22" y2="6" />
          </svg>
        </ToggleGroupItem>
      </ToggleGroup>

      <Separator orientation="vertical" className="h-5 max-[640px]:hidden" />

      <ToggleGroup
        value={[mode]}
        onValueChange={(v) => { if (v.length > 0) onModeChange(v[0] as EditorMode); }}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="chunk" className="text-xs font-mono">
          Chunk
        </ToggleGroupItem>
        <ToggleGroupItem value="manual" className="text-xs font-mono">
          Manual
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

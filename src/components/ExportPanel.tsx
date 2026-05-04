import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { EditorMode, ExportOptions } from '../types';

const CHUNK_PRESETS = [
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
  { label: '15m', value: 900 },
  { label: '30m', value: 1800 },
];

interface Props {
  mode: EditorMode;
  chunkDuration: number;
  onChunkDurationChange: (dur: number) => void;
  isProcessing: boolean;
  progress: number;
  onExport: (options: ExportOptions) => void;
}

export default function ExportPanel({ mode, chunkDuration, onChunkDurationChange, isProcessing, progress, onExport }: Props) {
  const [outputFormat, setOutputFormat] = useState<'mp3' | 'wav' | 'ogg'>('mp3');

  const handleExport = () => {
    onExport({ mode, chunkDuration, outputFormat });
  };

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 max-[640px]:flex-wrap max-[640px]:gap-2 max-[640px]:py-3">
      <Badge variant="outline" className="font-mono text-[10px] uppercase">
        {mode === 'chunk' ? 'Chunk' : 'Manual'}
      </Badge>

      {mode === 'chunk' && (
        <>
          <Separator orientation="vertical" className="h-5 max-[640px]:hidden" />
          <div className="flex items-center gap-1 max-[640px]:flex-wrap">
            {CHUNK_PRESETS.map((p) => (
              <Button
                key={p.value}
                variant={chunkDuration === p.value ? 'default' : 'ghost'}
                size="xs"
                className="font-mono text-[10px] max-[640px]:min-w-[44px]"
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
              className="w-14 h-6 px-1.5 text-[10px] text-center font-mono max-[640px]:h-[44px] max-[640px]:w-16"
            />
            <span className="text-[10px] text-muted-foreground">sec</span>
          </div>
        </>
      )}

      <Separator orientation="vertical" className="h-5 max-[640px]:hidden" />

      <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as 'mp3' | 'wav' | 'ogg')}>
        <SelectTrigger size="sm" className="h-6 w-[72px] text-[10px] font-mono max-[640px]:h-[44px] max-[640px]:w-[100px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mp3" className="text-xs font-mono">MP3</SelectItem>
          <SelectItem value="wav" className="text-xs font-mono">WAV</SelectItem>
          <SelectItem value="ogg" className="text-xs font-mono">OGG</SelectItem>
        </SelectContent>
      </Select>

      {isProcessing && (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-mono">{Math.round(progress * 100)}%</span>
        </div>
      )}

      <div className="flex-1" />

      <Button
        size="sm"
        onClick={handleExport}
        disabled={isProcessing}
        className="font-mono text-xs"
      >
        {isProcessing ? 'Processing...' : 'Export ZIP'}
      </Button>
    </div>
  );
}

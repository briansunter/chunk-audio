interface Props {
  progress?: number;
}

export default function LoadingOverlay({ progress }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-primary/95 backdrop-blur-xl">
      <div className="glass-card p-7 flex flex-col items-center gap-5">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-border-soft opacity-80" />
          <div
            className="absolute inset-0 rounded-full border-2 border-accent-green border-t-transparent animate-spin"
          />
        </div>
        <div className="text-center">
          <p className="text-text-primary text-sm font-medium">Loading audio engine</p>
          <p className="text-text-muted text-xs mt-1">Initializing FFmpeg WebAssembly in your browser</p>
        </div>
        {progress !== undefined && (
          <div className="w-48 h-1 bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-green transition-all duration-300 rounded-full"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

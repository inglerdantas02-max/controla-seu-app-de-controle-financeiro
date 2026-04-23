import { Mic, Trash2 } from "lucide-react";

interface Props {
  elapsedMs: number;
  level: number;
  cancelHint: boolean;
}

const formatTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
};

const RecordingIndicator = ({ elapsedMs, level, cancelHint }: Props) => {
  // 18 bars driven by audio level + small randomness for liveliness
  const bars = Array.from({ length: 18 });
  return (
    <div
      className={`flex-1 flex items-center gap-3 px-4 h-10 rounded-full transition-colors ${
        cancelHint ? "bg-destructive/15" : "bg-muted"
      }`}
    >
      {cancelHint ? (
        <>
          <Trash2 className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive font-medium">Solte para cancelar</span>
        </>
      ) : (
        <>
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inset-0 rounded-full bg-destructive/50 animate-ping" />
            <span className="relative rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
          <div className="flex items-end gap-[2px] h-5 flex-1 overflow-hidden">
            {bars.map((_, i) => {
              const base = 0.25 + Math.abs(Math.sin((i + elapsedMs / 120) * 0.6)) * 0.4;
              const h = Math.max(0.15, Math.min(1, base + level * 0.9));
              return (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-foreground/70"
                  style={{ height: `${h * 100}%` }}
                />
              );
            })}
          </div>
          <span className="text-xs tabular-nums text-muted-foreground shrink-0">
            {formatTime(elapsedMs)}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
            ← arraste para cancelar
          </span>
        </>
      )}
    </div>
  );
};

export default RecordingIndicator;

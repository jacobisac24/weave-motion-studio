import { Play, Pause, RotateCcw } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { getBlockRenderer } from "@/blocks/registry";
import type { Block } from "@/types/block";

// Side-effect: ensure block types are registered
import "@/blocks/triangle-slider";

interface PreviewProps {
  playback: {
    isPlaying: boolean;
    currentTime: number;
    play: () => void;
    pause: () => void;
    stop: () => void;
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const f = Math.floor((seconds % 1) * 30);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

function getActiveBlock(blocks: Block[], time: number): Block | null {
  return (
    blocks.find((b) => time >= b.startTime && time < b.startTime + b.duration) ??
    null
  );
}

export function EditorPreview({ playback }: PreviewProps) {
  const { sortedBlocks, totalDuration, selectBlock, state } = useProject();
  const activeBlock = getActiveBlock(sortedBlocks, playback.currentTime);

  // Try to get a renderer for the active block
  const Renderer = activeBlock ? getBlockRenderer(activeBlock.type) : undefined;
  const blockProgress = activeBlock
    ? Math.min(1, Math.max(0, (playback.currentTime - activeBlock.startTime) / activeBlock.duration))
    : 0;

  const canvasW = state.project.width;
  const canvasH = state.project.height;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-4xl">
      {/* Canvas area */}
      <div
        className="relative w-full bg-background rounded border border-editor-border overflow-hidden"
        style={{ aspectRatio: "16 / 9" }}
      >
        {/* Stage */}
        <div className="absolute inset-0">
          {activeBlock && Renderer ? (
            <Renderer
              progress={blockProgress}
              width={canvasW}
              height={canvasH}
              config={activeBlock.config}
            />
          ) : activeBlock ? (
            <div className="flex items-center justify-center h-full">
              <button
                className="text-center cursor-pointer bg-transparent border-none outline-none"
                onClick={() => selectBlock(activeBlock.id)}
              >
                <p className="text-sm font-medium text-foreground">{activeBlock.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeBlock.hasContent ? "Playing…" : "No content — awaiting generation"}
                </p>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-center">
              <p className="text-xs text-editor-text-dim">
                {sortedBlocks.length === 0
                  ? "Add blocks to the timeline to begin"
                  : "No block at current time"}
              </p>
            </div>
          )}
        </div>

        {/* Timecode overlay */}
        <div className="absolute top-2 right-3 font-mono text-xs text-editor-text-dim tabular-nums">
          {formatTime(playback.currentTime)}
          <span className="text-editor-text-dim/50 mx-1">/</span>
          {formatTime(totalDuration)}
        </div>
      </div>

      {/* Playback controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={playback.stop}
          className="p-2 rounded text-muted-foreground hover:text-foreground hover:bg-editor-surface-hover transition-colors active:scale-95"
          title="Reset"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={playback.isPlaying ? playback.pause : playback.play}
          className="p-2.5 rounded-full bg-primary text-primary-foreground hover:brightness-110 transition-all active:scale-95"
          title={playback.isPlaying ? "Pause" : "Play"}
        >
          {playback.isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
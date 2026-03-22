import { Play, Pause, RotateCcw } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { getBlockRenderer } from "@/blocks/registry";
import type { Block } from "@/types/block";
import { useRef, useState, useCallback, useEffect } from "react";

// Side-effect: ensure block types are registered
import "@/blocks/triangle-slider";
import "@/blocks/curve-vector";
import "@/blocks/tangent-boxes";
import "@/blocks/angle-measure";

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

function useZoomPan() {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.altKey) return;
    e.preventDefault();
    e.stopPropagation();

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => {
      const next = Math.min(10, Math.max(0.1, prev * delta));
      // Adjust pan so zoom centers on mouse position
      setPan((p) => ({
        x: mouseX - (mouseX - p.x) * (next / prev),
        y: mouseY - (mouseY - p.y) * (next / prev),
      }));
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.altKey && e.button === 2) {
      e.preventDefault();
      isPanning.current = true;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (e.altKey) e.preventDefault();
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      el.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleWheel, handleMouseMove, handleMouseUp]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  return { zoom, pan, containerRef, handleMouseDown, handleContextMenu, resetView };
}

export function EditorPreview({ playback }: PreviewProps) {
  const { sortedBlocks, totalDuration, selectBlock, state } = useProject();
  const activeBlock = getActiveBlock(sortedBlocks, playback.currentTime);
  const { zoom, pan, containerRef, handleMouseDown, handleContextMenu, resetView } = useZoomPan();

  const Renderer = activeBlock ? getBlockRenderer(activeBlock.type) : undefined;
  const blockProgress = activeBlock
    ? Math.min(1, Math.max(0, (playback.currentTime - activeBlock.startTime) / activeBlock.duration))
    : 0;

  const canvasW = state.project.width;
  const canvasH = state.project.height;
  const isZoomed = zoom !== 1 || pan.x !== 0 || pan.y !== 0;

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-4xl">
      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative w-full bg-background rounded border border-editor-border overflow-hidden cursor-default select-none"
        style={{ aspectRatio: "16 / 9" }}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenu}
      >
        {/* Stage with zoom/pan transform */}
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            willChange: "transform",
          }}
        >
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
        <div className="absolute top-2 right-3 font-mono text-xs text-editor-text-dim tabular-nums pointer-events-none">
          {formatTime(playback.currentTime)}
          <span className="text-editor-text-dim/50 mx-1">/</span>
          {formatTime(totalDuration)}
        </div>

        {/* Zoom indicator */}
        {isZoomed && (
          <button
            onClick={resetView}
            className="absolute bottom-2 left-3 font-mono text-[10px] text-editor-text-dim bg-background/80 px-1.5 py-0.5 rounded border border-editor-border hover:text-foreground transition-colors"
            title="Reset zoom (click)"
          >
            {Math.round(zoom * 100)}%
          </button>
        )}
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

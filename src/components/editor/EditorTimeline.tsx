import { useRef, useState, useCallback, useEffect } from "react";
import { Plus } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import type { Block } from "@/types/block";

const PIXELS_PER_SECOND = 80;
const RULER_HEIGHT = 24;
const TRACK_HEIGHT = 40;
const BLOCK_MARGIN = 2;

interface TimelineProps {
  playback: {
    currentTime: number;
    seekTo: (t: number) => void;
    isPlaying: boolean;
  };
}

function formatRulerTime(s: number): string {
  const min = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

export function EditorTimeline({ playback }: TimelineProps) {
  const {
    sortedBlocks,
    totalDuration,
    addBlock,
    selectBlock,
    reorderBlock,
    state,
  } = useProject();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    blockId: string;
    offsetX: number;
  } | null>(null);

  const timelineWidth = Math.max(totalDuration + 4, 14) * PIXELS_PER_SECOND;

  // Ruler ticks
  const ticks: number[] = [];
  for (let t = 0; t <= totalDuration + 4; t++) ticks.push(t);

  // Click on ruler to seek
  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      playback.seekTo(x / PIXELS_PER_SECOND);
    },
    [playback]
  );

  // Drag handlers
  const handleBlockMouseDown = useCallback(
    (e: React.MouseEvent, block: Block) => {
      e.stopPropagation();
      selectBlock(block.id);
      const blockLeft = block.startTime * PIXELS_PER_SECOND;
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      const containerRect = scrollRef.current?.getBoundingClientRect();
      const offsetX = e.clientX - (containerRect?.left ?? 0) + scrollLeft - blockLeft;
      setDragState({ blockId: block.id, offsetX });
    },
    [selectBlock]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragState || !scrollRef.current) return;
      const containerRect = scrollRef.current.getBoundingClientRect();
      const scrollLeft = scrollRef.current.scrollLeft;
      const x = e.clientX - containerRect.left + scrollLeft - dragState.offsetX;
      const newStart = Math.max(0, Math.round((x / PIXELS_PER_SECOND) * 10) / 10);
      reorderBlock(dragState.blockId, newStart);
    },
    [dragState, reorderBlock]
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  useEffect(() => {
    if (dragState) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Playhead position
  const playheadX = playback.currentTime * PIXELS_PER_SECOND;

  return (
    <div className="flex flex-col h-full">
      {/* Timeline header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-editor-border bg-editor-surface">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Timeline
        </span>
        <button
          onClick={() => addBlock()}
          className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-editor-surface-hover rounded transition-colors active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Block
        </button>
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative">
        <div style={{ width: timelineWidth, minHeight: "100%" }} className="relative">
          {/* Ruler */}
          <div
            className="sticky top-0 z-10 cursor-pointer border-b border-editor-border"
            style={{ height: RULER_HEIGHT }}
            onClick={handleRulerClick}
          >
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute top-0 flex flex-col items-start"
                style={{ left: t * PIXELS_PER_SECOND }}
              >
                <div className="w-px bg-editor-timeline-ruler" style={{ height: t % 5 === 0 ? 12 : 6 }} />
                {t % 2 === 0 && (
                  <span className="text-[9px] text-editor-text-dim font-mono ml-1 mt-0.5 tabular-nums">
                    {formatRulerTime(t)}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Track area */}
          <div className="relative" style={{ paddingTop: 4 }}>
            {sortedBlocks.map((block) => {
              const isSelected = state.selectedBlockId === block.id;
              const isDragging = dragState?.blockId === block.id;
              return (
                <div
                  key={block.id}
                  className={`absolute rounded cursor-grab select-none transition-shadow ${
                    isDragging ? "z-20 shadow-lg shadow-primary/20" : "z-10"
                  } ${
                    isSelected
                      ? "bg-editor-block-selected border border-editor-block-selected-border"
                      : "bg-editor-block border border-editor-block-border hover:brightness-110"
                  }`}
                  style={{
                    left: block.startTime * PIXELS_PER_SECOND,
                    width: block.duration * PIXELS_PER_SECOND - BLOCK_MARGIN * 2,
                    height: TRACK_HEIGHT,
                    top: block.track * (TRACK_HEIGHT + 4) + 4,
                    marginLeft: BLOCK_MARGIN,
                  }}
                  onMouseDown={(e) => handleBlockMouseDown(e, block)}
                >
                  <div className="px-2 py-1.5 h-full flex flex-col justify-center overflow-hidden">
                    <span className="text-[11px] font-medium text-foreground truncate leading-tight">
                      {block.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground tabular-nums">
                      {block.duration.toFixed(1)}s
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none"
            style={{ left: playheadX }}
          >
            {/* Head triangle */}
            <div
              className="w-0 h-0 mx-auto"
              style={{
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "6px solid hsl(var(--editor-playhead))",
                marginLeft: -5,
              }}
            />
            {/* Line */}
            <div className="w-px h-full bg-primary/80 -mt-px" style={{ marginLeft: -0.5 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

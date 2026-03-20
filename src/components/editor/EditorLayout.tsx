import { useProject } from "@/context/ProjectContext";
import { usePlayback } from "@/hooks/usePlayback";
import { EditorToolbar } from "./EditorToolbar";
import { EditorPreview } from "./EditorPreview";
import { EditorTimeline } from "./EditorTimeline";
import { EditorInspector } from "./EditorInspector";

export function EditorLayout() {
  const { totalDuration, selectedBlock } = useProject();
  const playback = usePlayback(totalDuration);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-editor-bg select-none">
      {/* Toolbar */}
      <EditorToolbar />

      {/* Main area: preview + inspector */}
      <div className="flex flex-1 min-h-0">
        {/* Preview */}
        <div className="flex-1 flex items-center justify-center p-4 min-w-0">
          <EditorPreview playback={playback} />
        </div>

        {/* Inspector */}
        <div className="w-72 border-l border-editor-border bg-editor-panel flex-shrink-0 overflow-y-auto">
          <EditorInspector block={selectedBlock} />
        </div>
      </div>

      {/* Timeline */}
      <div className="h-56 border-t border-editor-border bg-editor-timeline-bg flex-shrink-0">
        <EditorTimeline playback={playback} />
      </div>
    </div>
  );
}

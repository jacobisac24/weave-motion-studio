import { useProject } from "@/context/ProjectContext";
import { blockRegistry } from "@/context/ProjectContext";
import { Film, FolderOpen, Save, Download, Plus, Video, Loader2, X } from "lucide-react";
import { useVideoExport } from "@/hooks/useVideoExport";

// Ensure block types are registered
import "@/blocks/triangle-slider";

export function EditorToolbar() {
  const { state, setProjectName, addBlock } = useProject();
  const blockTypes = blockRegistry.getAll();
  const { exportVideo, status, progress, cancel } = useVideoExport();

  const isExporting = status === "rendering" || status === "encoding";

  const handleSave = () => {
    const data = JSON.stringify(state.project, null, 2);
    localStorage.setItem(`motion_project_${state.project.id}`, data);
    const toast = document.createElement("div");
    toast.textContent = "Project saved";
    toast.className =
      "fixed top-4 right-4 z-50 bg-primary text-primary-foreground text-xs px-3 py-2 rounded shadow-lg animate-in fade-in slide-in-from-top-2";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1500);
  };

  const handleExportJSON = () => {
    const data = JSON.stringify(state.project, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.project.name.replace(/\s+/g, "_")}.project.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpen = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const project = JSON.parse(ev.target?.result as string);
          if (project && project.id && project.blocks) {
            (window as any).__motionLoadProject?.(project);
          }
        } catch {
          console.error("Invalid project file");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleExportVideo = () => {
    if (state.project.blocks.length === 0) return;
    exportVideo(state.project);
  };

  return (
    <header className="h-11 flex items-center justify-between px-3 bg-editor-surface border-b border-editor-border flex-shrink-0">
      {/* Left: logo + project name */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-primary">
          <Film className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wide uppercase">Motion</span>
        </div>
        <div className="w-px h-5 bg-editor-border" />
        <input
          className="bg-transparent text-sm text-editor-text-bright font-medium outline-none border-none w-48 hover:bg-editor-surface-hover px-1.5 py-0.5 rounded transition-colors"
          value={state.project.name}
          onChange={(e) => setProjectName(e.target.value)}
        />
      </div>

      {/* Center: add block buttons */}
      <div className="flex items-center gap-1">
        {blockTypes.map((desc) => (
          <button
            key={desc.type}
            onClick={() => addBlock(desc.type)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-editor-surface-hover rounded transition-colors active:scale-[0.97]"
            title={desc.description}
          >
            <Plus className="w-3 h-3" />
            {desc.label}
          </button>
        ))}
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-1">
        <button onClick={handleOpen} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-editor-surface-hover rounded transition-colors active:scale-[0.97]" title="Open">
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Open</span>
        </button>
        <button onClick={handleSave} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-editor-surface-hover rounded transition-colors active:scale-[0.97]" title="Save">
          <Save className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>
        <button onClick={handleExportJSON} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-editor-surface-hover rounded transition-colors active:scale-[0.97]" title="Export JSON">
          <Download className="w-3.5 h-3.5" />
          <span>JSON</span>
        </button>

        <div className="w-px h-5 bg-editor-border mx-1" />

        {/* Save as Video — the star button */}
        {isExporting ? (
          <button
            onClick={cancel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-destructive/15 text-destructive rounded transition-colors active:scale-[0.97]"
            title="Cancel export"
          >
            <X className="w-3.5 h-3.5" />
            <span>{status === "encoding" ? "Encoding…" : `${Math.round(progress * 100)}%`}</span>
          </button>
        ) : (
          <button
            onClick={handleExportVideo}
            disabled={state.project.blocks.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:brightness-110 transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
            title="Save as Video"
          >
            {status === "done" ? (
              <>
                <Video className="w-3.5 h-3.5" />
                <span>Done!</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5" />
                <span>Save as Video</span>
              </>
            )}
          </button>
        )}
      </div>
    </header>
  );
}

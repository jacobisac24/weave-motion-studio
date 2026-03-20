import { useProject } from "@/context/ProjectContext";
import { blockRegistry } from "@/context/ProjectContext";
import { Film, FolderOpen, Save, Download, Plus } from "lucide-react";

// Ensure block types are registered
import "@/blocks/triangle-slider";

export function EditorToolbar() {
  const { state, setProjectName, addBlock } = useProject();
  const blockTypes = blockRegistry.getAll();

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

      {/* Center: add block dropdown */}
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
        {[
          { icon: FolderOpen, label: "Open" },
          { icon: Save, label: "Save" },
          { icon: Download, label: "Export" },
        ].map(({ icon: Icon, label }) => (
          <button
            key={label}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-editor-surface-hover rounded transition-colors active:scale-[0.97]"
            title={label}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </header>
  );
}

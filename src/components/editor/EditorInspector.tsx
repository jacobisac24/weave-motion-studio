import { useProject } from "@/context/ProjectContext";
import type { Block } from "@/types/block";
import { Copy, Trash2, Download, Clock, Hash, Type, MessageSquare } from "lucide-react";

interface InspectorProps {
  block: Block | null;
}

export function EditorInspector({ block }: InspectorProps) {
  const { updateBlock, deleteBlock, duplicateBlock } = useProject();

  if (!block) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <p className="text-xs text-editor-text-dim">Select a block to inspect</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-editor-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Inspector
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Name */}
        <Field icon={Type} label="Name">
          <input
            className="w-full bg-editor-surface text-sm text-foreground rounded px-2 py-1.5 border border-editor-border outline-none focus:border-primary/50 transition-colors"
            value={block.name}
            onChange={(e) => updateBlock(block.id, { name: e.target.value })}
          />
        </Field>

        {/* Duration */}
        <Field icon={Clock} label="Duration (s)">
          <input
            type="number"
            step={0.1}
            min={0.1}
            className="w-full bg-editor-surface text-sm text-foreground rounded px-2 py-1.5 border border-editor-border outline-none focus:border-primary/50 transition-colors font-mono tabular-nums"
            value={block.duration}
            onChange={(e) =>
              updateBlock(block.id, { duration: Math.max(0.1, parseFloat(e.target.value) || 0.1) })
            }
          />
        </Field>

        {/* Start time */}
        <Field icon={Clock} label="Start (s)">
          <input
            type="number"
            step={0.1}
            min={0}
            className="w-full bg-editor-surface text-sm text-foreground rounded px-2 py-1.5 border border-editor-border outline-none focus:border-primary/50 transition-colors font-mono tabular-nums"
            value={block.startTime}
            onChange={(e) =>
              updateBlock(block.id, { startTime: Math.max(0, parseFloat(e.target.value) || 0) })
            }
          />
        </Field>

        {/* ID */}
        <Field icon={Hash} label="ID">
          <span className="text-xs text-editor-text-dim font-mono break-all">{block.id}</span>
        </Field>

        {/* Type */}
        <Field icon={Hash} label="Type">
          <span className="text-xs text-muted-foreground">{block.type}</span>
        </Field>

        {/* Prompt */}
        <Field icon={MessageSquare} label="Prompt">
          <textarea
            className="w-full bg-editor-surface text-sm text-foreground rounded px-2 py-1.5 border border-editor-border outline-none focus:border-primary/50 transition-colors resize-y min-h-[60px]"
            rows={3}
            placeholder="Describe what this block should animate…"
            value={block.prompt}
            onChange={(e) => updateBlock(block.id, { prompt: e.target.value })}
          />
        </Field>

        {/* Separator */}
        <div className="border-t border-editor-border" />

        {/* Actions */}
        <div className="space-y-1.5">
          <ActionButton
            icon={Copy}
            label="Duplicate Block"
            onClick={() => duplicateBlock(block.id)}
          />
          <ActionButton
            icon={Download}
            label="Export Block"
            onClick={() => {
              const data = JSON.stringify(block, null, 2);
              const blob = new Blob([data], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${block.name.replace(/\s+/g, "_")}.block.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          />
          <ActionButton
            icon={Trash2}
            label="Delete Block"
            variant="destructive"
            onClick={() => deleteBlock(block.id)}
          />
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <Icon className="w-3 h-3" />
        {label}
      </label>
      {children}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  variant?: "destructive";
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded text-xs transition-colors active:scale-[0.98] ${
        variant === "destructive"
          ? "text-destructive hover:bg-destructive/10"
          : "text-muted-foreground hover:text-foreground hover:bg-editor-surface-hover"
      }`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

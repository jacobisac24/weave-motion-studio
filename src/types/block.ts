// Block type system — the contract between editor and content modules.
// Blocks are self-contained units. The editor never depends on specific block types.

export interface BlockDescriptor {
  /** Unique block type identifier, e.g. "fade-in", "code-highlight" */
  type: string;
  /** Human-readable label */
  label: string;
  /** Default duration in seconds */
  defaultDuration: number;
  /** Description of what this block type does */
  description?: string;
}

export interface Block {
  /** Unique instance id */
  id: string;
  /** Reference to BlockDescriptor.type */
  type: string;
  /** User-facing name */
  name: string;
  /** Duration in seconds */
  duration: number;
  /** Start time on the timeline in seconds */
  startTime: number;
  /** Track index (for future multi-track support) */
  track: number;
  /** Prompt or content description (for future AI generation) */
  prompt: string;
  /** Arbitrary config payload — block-type-specific */
  config: Record<string, unknown>;
  /** Whether this block has been rendered / has content */
  hasContent: boolean;
  /** Color tag for visual identification */
  color?: string;
}

export interface Project {
  id: string;
  name: string;
  /** Frames per second */
  fps: number;
  /** Canvas width */
  width: number;
  /** Canvas height */
  height: number;
  /** All blocks in the project */
  blocks: Block[];
  /** Total duration is derived from blocks, but can be overridden */
  durationOverride?: number;
}

// Block registry — extensible system for registering new block types
export interface BlockRegistry {
  descriptors: Map<string, BlockDescriptor>;
  register: (descriptor: BlockDescriptor) => void;
  get: (type: string) => BlockDescriptor | undefined;
  getAll: () => BlockDescriptor[];
}

// Export-related types
export interface ExportOptions {
  format: "json" | "frames" | "video";
  blockIds?: string[]; // specific blocks, or all if undefined
  fps?: number;
  width?: number;
  height?: number;
}

export interface ExportResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

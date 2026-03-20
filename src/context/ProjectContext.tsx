import React, { createContext, useContext, useReducer, useCallback, useMemo } from "react";
import type { Block, Project, BlockRegistry, BlockDescriptor } from "@/types/block";

// --- Block Registry (singleton) ---
function createBlockRegistry(): BlockRegistry {
  const descriptors = new Map<string, BlockDescriptor>();
  return {
    descriptors,
    register(desc) { descriptors.set(desc.type, desc); },
    get(type) { return descriptors.get(type); },
    getAll() { return Array.from(descriptors.values()); },
  };
}

export const blockRegistry = createBlockRegistry();

// Register a default "empty" block type
blockRegistry.register({
  type: "empty",
  label: "Empty Block",
  defaultDuration: 2,
  description: "A placeholder block with no visual content yet.",
});

// --- Project State ---
interface ProjectState {
  project: Project;
  selectedBlockId: string | null;
  clipboard: Block | null;
}

type ProjectAction =
  | { type: "ADD_BLOCK"; block: Block }
  | { type: "UPDATE_BLOCK"; id: string; updates: Partial<Block> }
  | { type: "DELETE_BLOCK"; id: string }
  | { type: "DUPLICATE_BLOCK"; id: string }
  | { type: "SELECT_BLOCK"; id: string | null }
  | { type: "REORDER_BLOCKS"; blockId: string; newStartTime: number }
  | { type: "SET_PROJECT"; project: Project }
  | { type: "SET_PROJECT_NAME"; name: string };

let blockCounter = 1;

function generateId(): string {
  return `block_${Date.now()}_${blockCounter++}`;
}

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case "ADD_BLOCK": {
      return {
        ...state,
        project: {
          ...state.project,
          blocks: [...state.project.blocks, action.block],
        },
        selectedBlockId: action.block.id,
      };
    }
    case "UPDATE_BLOCK": {
      return {
        ...state,
        project: {
          ...state.project,
          blocks: state.project.blocks.map((b) =>
            b.id === action.id ? { ...b, ...action.updates } : b
          ),
        },
      };
    }
    case "DELETE_BLOCK": {
      return {
        ...state,
        project: {
          ...state.project,
          blocks: state.project.blocks.filter((b) => b.id !== action.id),
        },
        selectedBlockId:
          state.selectedBlockId === action.id ? null : state.selectedBlockId,
      };
    }
    case "DUPLICATE_BLOCK": {
      const source = state.project.blocks.find((b) => b.id === action.id);
      if (!source) return state;
      const maxEnd = state.project.blocks.reduce(
        (max, b) => Math.max(max, b.startTime + b.duration),
        0
      );
      const dup: Block = {
        ...source,
        id: generateId(),
        name: `${source.name} (copy)`,
        startTime: maxEnd,
      };
      return {
        ...state,
        project: {
          ...state.project,
          blocks: [...state.project.blocks, dup],
        },
        selectedBlockId: dup.id,
      };
    }
    case "SELECT_BLOCK":
      return { ...state, selectedBlockId: action.id };
    case "REORDER_BLOCKS": {
      return {
        ...state,
        project: {
          ...state.project,
          blocks: state.project.blocks.map((b) =>
            b.id === action.blockId
              ? { ...b, startTime: Math.max(0, action.newStartTime) }
              : b
          ),
        },
      };
    }
    case "SET_PROJECT":
      return { ...state, project: action.project, selectedBlockId: null };
    case "SET_PROJECT_NAME":
      return {
        ...state,
        project: { ...state.project, name: action.name },
      };
    default:
      return state;
  }
}

const defaultProject: Project = {
  id: "project_1",
  name: "Untitled Project",
  fps: 30,
  width: 1920,
  height: 1080,
  blocks: [],
};

const defaultState: ProjectState = {
  project: defaultProject,
  selectedBlockId: null,
  clipboard: null,
};

// --- Context ---
interface ProjectContextValue {
  state: ProjectState;
  addBlock: (type?: string) => void;
  updateBlock: (id: string, updates: Partial<Block>) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  selectBlock: (id: string | null) => void;
  reorderBlock: (blockId: string, newStartTime: number) => void;
  setProjectName: (name: string) => void;
  loadProject: (project: Project) => void;
  selectedBlock: Block | null;
  totalDuration: number;
  sortedBlocks: Block[];
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, defaultState);

  const addBlock = useCallback(
    (type = "empty") => {
      const desc = blockRegistry.get(type);
      const maxEnd = state.project.blocks.reduce(
        (max, b) => Math.max(max, b.startTime + b.duration),
        0
      );
      const block: Block = {
        id: generateId(),
        type,
        name: `${desc?.label ?? "Block"} ${state.project.blocks.length + 1}`,
        duration: desc?.defaultDuration ?? 2,
        startTime: maxEnd,
        track: 0,
        prompt: "",
        config: {},
        hasContent: false,
      };
      dispatch({ type: "ADD_BLOCK", block });
    },
    [state.project.blocks]
  );

  const updateBlock = useCallback(
    (id: string, updates: Partial<Block>) =>
      dispatch({ type: "UPDATE_BLOCK", id, updates }),
    []
  );
  const deleteBlock = useCallback(
    (id: string) => dispatch({ type: "DELETE_BLOCK", id }),
    []
  );
  const duplicateBlock = useCallback(
    (id: string) => dispatch({ type: "DUPLICATE_BLOCK", id }),
    []
  );
  const selectBlock = useCallback(
    (id: string | null) => dispatch({ type: "SELECT_BLOCK", id }),
    []
  );
  const reorderBlock = useCallback(
    (blockId: string, newStartTime: number) =>
      dispatch({ type: "REORDER_BLOCKS", blockId, newStartTime }),
    []
  );
  const setProjectName = useCallback(
    (name: string) => dispatch({ type: "SET_PROJECT_NAME", name }),
    []
  );

  const selectedBlock = useMemo(
    () =>
      state.project.blocks.find((b) => b.id === state.selectedBlockId) ?? null,
    [state.project.blocks, state.selectedBlockId]
  );

  const totalDuration = useMemo(
    () => {
      if (state.project.durationOverride != null) return state.project.durationOverride;
      const computed = state.project.blocks.reduce(
        (max, b) => Math.max(max, b.startTime + b.duration),
        0
      );
      return computed || 10;
    },
    [state.project.blocks, state.project.durationOverride]
  );

  const sortedBlocks = useMemo(
    () => [...state.project.blocks].sort((a, b) => a.startTime - b.startTime),
    [state.project.blocks]
  );

  const value = useMemo(
    () => ({
      state,
      addBlock,
      updateBlock,
      deleteBlock,
      duplicateBlock,
      selectBlock,
      reorderBlock,
      setProjectName,
      selectedBlock,
      totalDuration,
      sortedBlocks,
    }),
    [
      state,
      addBlock,
      updateBlock,
      deleteBlock,
      duplicateBlock,
      selectBlock,
      reorderBlock,
      setProjectName,
      selectedBlock,
      totalDuration,
      sortedBlocks,
    ]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}

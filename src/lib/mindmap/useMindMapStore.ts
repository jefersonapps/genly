import { create } from 'zustand';

export const NODE_MIN_WIDTH = 120;
export const NODE_MIN_HEIGHT = 44;
export const NODE_DEFAULT_WIDTH = 160;
export const NODE_DEFAULT_HEIGHT = 50;

export interface MindMapNode {
  id: string;
  parentId: string | null;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  collapsed: boolean;
  /** Per-direction collapse: e.g. ['right','top'] */
  collapsedDirs?: string[];
  depth: number;
  color?: string;
  pinnedX?: number;
  pinnedY?: number;
  /** User-defined size — overrides layout defaults when set */
  customWidth?: number;
  customHeight?: number;
}

export type BackgroundPattern = 'none' | 'grid' | 'dots' | 'lines';

interface MindMapState {
  nodes: MindMapNode[];
  selectedId: string | null;
  rootId: string | null;
  canvasBgColor: string | null;
  bgPattern: BackgroundPattern;

  setNodes: (nodes: MindMapNode[]) => void;
  addNode: (parentId: string, title?: string) => void;
  deleteNode: (id: string) => void;
  updateNodeTitle: (id: string, title: string) => void;
  pinNodePosition: (id: string, x: number, y: number) => void;
  resizeNode: (id: string, width: number, height: number) => void;
  setNodeColor: (id: string, color: string) => void;
  toggleCollapse: (id: string) => void;
  toggleCollapseDir: (id: string, dir: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  select: (id: string | null) => void;
  setRootId: (id: string) => void;
  initRoot: (title: string) => void;
  setCanvasBgColor: (color: string | null) => void;
  setBgPattern: (pattern: BackgroundPattern) => void;
  setWholeState: (state: Partial<MindMapState>) => void;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export const useMindMapStore = create<MindMapState>((set) => ({
  nodes: [],
  selectedId: null,
  rootId: null,
  canvasBgColor: null,
  bgPattern: 'none',

  setNodes: (nodes) => set({ nodes }),

  initRoot: (title) => {
    const rootId = generateId();
    set({
      nodes: [{
        id: rootId,
        title,
        parentId: null,
        collapsed: false,
        depth: 0,
        x: 0, y: 0,
        width: NODE_DEFAULT_WIDTH,
        height: NODE_DEFAULT_HEIGHT,
      }],
      rootId,
      selectedId: rootId,
    });
  },

  addNode: (parentId, title) =>
    set((state) => {
      const parentNode = state.nodes.find((n) => n.id === parentId);
      if (!parentNode) return state;
      const newNode: MindMapNode = {
        id: generateId(),
        title: title || 'Novo tópico',
        parentId,
        collapsed: false,
        depth: parentNode.depth + 1,
        x: 0, y: 0,
        width: NODE_DEFAULT_WIDTH,
        height: NODE_DEFAULT_HEIGHT,
      };
      // Auto-expand parent if it had collapsed its boolean flag
      const updatedNodes = state.nodes.map((n) =>
        n.id === parentId ? { ...n, collapsed: false } : n,
      );
      return { nodes: [...updatedNodes, newNode], selectedId: newNode.id };
    }),

  deleteNode: (id) =>
    set((state) => {
      if (id === state.rootId) return state;
      const idsToRemove = new Set<string>();
      const collect = (pid: string) => {
        idsToRemove.add(pid);
        state.nodes.forEach((n) => { if (n.parentId === pid) collect(n.id); });
      };
      collect(id);
      return {
        nodes: state.nodes.filter((n) => !idsToRemove.has(n.id)),
        selectedId: idsToRemove.has(state.selectedId ?? '') ? state.rootId : state.selectedId,
      };
    }),

  updateNodeTitle: (id, title) =>
    set((state) => ({
      nodes: state.nodes.map((n) => n.id === id ? { ...n, title } : n),
    })),

  pinNodePosition: (id, x, y) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, pinnedX: x, pinnedY: y } : n,
      ),
    })),

  resizeNode: (id, width, height) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id
          ? {
              ...n,
              customWidth: Math.max(NODE_MIN_WIDTH, width),
              customHeight: Math.max(NODE_MIN_HEIGHT, height),
            }
          : n,
      ),
    })),

  setNodeColor: (id, color) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, color } : n,
      ),
    })),

  toggleCollapse: (id) =>
    set((state) => ({
      nodes: state.nodes.map((n) => n.id === id ? { ...n, collapsed: !n.collapsed } : n),
    })),

  toggleCollapseDir: (id, dir) =>
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== id) return n;
        const dirs = n.collapsedDirs ?? [];
        const has = dirs.includes(dir);
        return {
          ...n,
          collapsedDirs: has ? dirs.filter((d) => d !== dir) : [...dirs, dir],
        };
      }),
    })),

  expandAll: () =>
    set((state) => ({
      nodes: state.nodes.map((n) => ({ ...n, collapsed: false, collapsedDirs: [] })),
    })),

  collapseAll: () =>
    set((state) => {
      const allDirs = ['right', 'left', 'top', 'bottom'];
      return {
        nodes: state.nodes.map((n) => ({
          ...n,
          collapsed: n.id !== state.rootId,
          collapsedDirs: allDirs,
        })),
      };
    }),

  select: (id) => set({ selectedId: id }),
  setRootId: (id) => set({ rootId: id }),
  setCanvasBgColor: (color) => set({ canvasBgColor: color }),
  setBgPattern: (pattern) => set({ bgPattern: pattern }),
  setWholeState: (newState) => set(newState),
}));
import type { MindMapNode } from './useMindMapStore';
import { NODE_DEFAULT_HEIGHT, NODE_DEFAULT_WIDTH, NODE_MIN_HEIGHT } from './useMindMapStore';

export interface LayoutConfig {
  horizontalGap: number;
  verticalGap: number;
  /** Used only as fallback when node has no customWidth */
  nodeWidth: number;
  /** Used only as fallback when node has no customHeight */
  nodeHeight: number;
}

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  horizontalGap: 60,
  verticalGap: 24,
  nodeWidth: NODE_DEFAULT_WIDTH,
  nodeHeight: NODE_DEFAULT_HEIGHT,
};

// ---------------------------------------------------------------------------
// Text-wrap height estimation (JS-side, no Skia font needed)
// ---------------------------------------------------------------------------
const FONT_SIZE = 13;
const LINE_HEIGHT = FONT_SIZE * 1.45;
const H_PADDING = 32; // 16px each side
const V_PADDING = 20; // 10px each side
const CHARS_PER_PX = 1 / (FONT_SIZE * 0.55); // approx char width

export function estimateNodeHeight(title: string, nodeWidth: number): number {
  const maxCharsPerLine = Math.floor((nodeWidth - H_PADDING) * CHARS_PER_PX);
  if (maxCharsPerLine <= 0) return NODE_DEFAULT_HEIGHT;

  // Simple greedy word-wrap
  const words = title.split(' ');
  let lines = 1;
  let currentLen = 0;
  for (const word of words) {
    const needed = currentLen === 0 ? word.length : currentLen + 1 + word.length;
    if (needed > maxCharsPerLine && currentLen > 0) {
      lines++;
      currentLen = word.length;
    } else {
      currentLen = needed;
    }
  }

  const h = Math.ceil(lines * LINE_HEIGHT + V_PADDING);
  return Math.max(h, NODE_MIN_HEIGHT);
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

function buildChildrenMap(nodes: MindMapNode[]): Map<string, MindMapNode[]> {
  const map = new Map<string, MindMapNode[]>();
  for (const node of nodes) {
    if (node.parentId !== null) {
      const arr = map.get(node.parentId);
      if (arr) arr.push(node);
      else map.set(node.parentId, [node]);
    }
  }
  return map;
}

function resolveNodeSize(
  node: MindMapNode,
  cfg: LayoutConfig,
): { width: number; height: number } {
  const width = node.customWidth ?? cfg.nodeWidth;
  // If user hasn't manually resized height, auto-compute from text wrapping
  const height = node.customHeight ?? estimateNodeHeight(node.title, width);
  return { width, height };
}

function subtreeHeight(
  nodeId: string,
  nodesMap: Map<string, MindMapNode>,
  childrenMap: Map<string, MindMapNode[]>,
  collapsedSet: Set<string>,
  cfg: LayoutConfig,
): number {
  const node = nodesMap.get(nodeId);
  if (!node) return cfg.nodeHeight;
  const { height } = resolveNodeSize(node, cfg);
  if (collapsedSet.has(nodeId)) return height;
  const children = childrenMap.get(nodeId);
  if (!children || children.length === 0) return height;
  let total = 0;
  for (let i = 0; i < children.length; i++) {
    total += subtreeHeight(children[i].id, nodesMap, childrenMap, collapsedSet, cfg);
    if (i < children.length - 1) total += cfg.verticalGap;
  }
  return Math.max(total, height);
}

export function computeLayout(
  nodes: MindMapNode[],
  rootId: string | null,
  config: Partial<LayoutConfig> = {},
): MindMapNode[] {
  if (!rootId || nodes.length === 0) return nodes;

  const cfg = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  const childrenMap = buildChildrenMap(nodes);
  const nodesMap = new Map(nodes.map((n) => [n.id, n]));
  const collapsedSet = new Set(nodes.filter((n) => n.collapsed).map((n) => n.id));
  const positions = new Map<string, { x: number; y: number; depth: number }>();

  function subtreeHeightGroup(group: MindMapNode[]): number {
    if (group.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < group.length; i++) {
       total += subtreeHeight(group[i].id, nodesMap, childrenMap, collapsedSet, cfg);
       if (i < group.length - 1) total += cfg.verticalGap;
    }
    return total;
  }

  function layoutSubtree(nodeId: string, depth: number, topY: number, dir: 'left' | 'right'): void {
    const node = nodesMap.get(nodeId)!;
    const { width, height } = resolveNodeSize(node, cfg);

    if (depth === 0) {
      const leftChildren = (childrenMap.get(nodeId) || []).filter(c => c.layoutDir === 'left');
      const rightChildren = (childrenMap.get(nodeId) || []).filter(c => c.layoutDir !== 'left');
      
      const leftH = subtreeHeightGroup(leftChildren);
      const rightH = subtreeHeightGroup(rightChildren);
      const maxH = Math.max(leftH, rightH, height);
      const baseY = topY + maxH / 2 - height / 2;
      positions.set(nodeId, { x: 0, y: baseY, depth });

      if (collapsedSet.has(nodeId)) return;

      let currentY = baseY + height / 2 - leftH / 2;
      for (const child of leftChildren) {
         const childH = subtreeHeight(child.id, nodesMap, childrenMap, collapsedSet, cfg);
         layoutSubtree(child.id, depth + 1, currentY, 'left');
         currentY += childH + cfg.verticalGap;
      }
      
      currentY = baseY + height / 2 - rightH / 2;
      for (const child of rightChildren) {
         const childH = subtreeHeight(child.id, nodesMap, childrenMap, collapsedSet, cfg);
         layoutSubtree(child.id, depth + 1, currentY, 'right');
         currentY += childH + cfg.verticalGap;
      }
      return;
    }

    const baseX = _getXOffset(nodeId, nodesMap, childrenMap, cfg, depth, dir);
    const treeH = subtreeHeight(nodeId, nodesMap, childrenMap, collapsedSet, cfg);
    const baseY = topY + treeH / 2 - height / 2;
    positions.set(nodeId, { x: baseX, y: baseY, depth });

    if (collapsedSet.has(nodeId)) return;
    const children = childrenMap.get(nodeId);
    if (!children || children.length === 0) return;

    let currentY = topY;
    for (const child of children) {
      const childH = subtreeHeight(child.id, nodesMap, childrenMap, collapsedSet, cfg);
      layoutSubtree(child.id, depth + 1, currentY, dir);
      currentY += childH + cfg.verticalGap;
    }
  }

  layoutSubtree(rootId, 0, 0, 'right');

  return nodes.map((node) => {
    const pos = positions.get(node.id);
    if (!pos) return node;
    const { width, height } = resolveNodeSize(node, cfg);
    const x = node.pinnedX !== undefined ? node.pinnedX : pos.x;
    const y = node.pinnedY !== undefined ? node.pinnedY : pos.y;
    return { ...node, x, y, depth: pos.depth, width, height };
  });
}

/**
 * Compute x offset by summing widths+gaps along the ancestor chain.
 * This makes each column respect the actual widths of parent nodes.
 */
function _getXOffset(
  nodeId: string,
  nodesMap: Map<string, MindMapNode>,
  childrenMap: Map<string, MindMapNode[]>,
  cfg: LayoutConfig,
  depth: number,
  dir: 'left' | 'right'
): number {
  if (depth === 0) return 0;

  // Find ancestor chain
  const chain: MindMapNode[] = [];
  let current = nodesMap.get(nodeId);
  while (current) {
    chain.unshift(current);
    current = current.parentId ? nodesMap.get(current.parentId) : undefined;
  }

  let x = 0;
  if (dir === 'right') {
    for (let i = 0; i < chain.length - 1; i++) {
      const { width } = resolveNodeSize(chain[i], cfg);
      x += width + cfg.horizontalGap;
    }
  } else {
    for (let i = 1; i < chain.length; i++) {
      const { width: childW } = resolveNodeSize(chain[i], cfg);
      x -= childW + cfg.horizontalGap;
    }
  }
  return x;
}

// ---------------------------------------------------------------------------
// Edges
// ---------------------------------------------------------------------------

export interface EdgeData {
  fromX: number; fromY: number;
  toX: number; toY: number;
  parentId: string; childId: string;
  direction: 'right' | 'left' | 'top' | 'bottom';
}

export function computeEdges(
  nodes: MindMapNode[],
  collapsedSet: Set<string>,
): EdgeData[] {
  'worklet';
  const nodeMap = new Map<string, MindMapNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const edges: EdgeData[] = [];
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const parent = nodeMap.get(node.parentId);
    if (!parent || collapsedSet.has(parent.id)) continue;

    // Center points
    const pCx = parent.x + parent.width / 2;
    const pCy = parent.y + parent.height / 2;
    const cCx = node.x + node.width / 2;
    const cCy = node.y + node.height / 2;

    const dx = cCx - pCx;
    const dy = cCy - pCy;

    let direction: EdgeData['direction'];
    let fromX: number, fromY: number, toX: number, toY: number;

    if (Math.abs(dx) >= Math.abs(dy)) {
      // Horizontal dominant
      if (dx >= 0) {
        // Child is to the RIGHT → exit parent right, enter child left
        direction = 'right';
        fromX = parent.x + parent.width;
        fromY = pCy;
        toX   = node.x;
        toY   = cCy;
      } else {
        // Child is to the LEFT → exit parent left, enter child right
        direction = 'left';
        fromX = parent.x;
        fromY = pCy;
        toX   = node.x + node.width;
        toY   = cCy;
      }
    } else {
      // Vertical dominant
      if (dy >= 0) {
        // Child is BELOW → exit parent bottom, enter child top
        direction = 'bottom';
        fromX = pCx;
        fromY = parent.y + parent.height;
        toX   = cCx;
        toY   = node.y;
      } else {
        // Child is ABOVE → exit parent top, enter child bottom
        direction = 'top';
        fromX = pCx;
        fromY = parent.y;
        toX   = cCx;
        toY   = node.y + node.height;
      }
    }

    edges.push({ fromX, fromY, toX, toY, parentId: parent.id, childId: node.id, direction });
  }
  return edges;
}

// ---------------------------------------------------------------------------
// Directional collapse helpers
// ---------------------------------------------------------------------------

/**
 * For each parent, compute which directions (right/left/top/bottom) have
 * children based on the relative position of child center vs parent center.
 */
export function computeChildDirs(nodes: MindMapNode[]): Map<string, Set<string>> {
  const nodeMap = new Map<string, MindMapNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const result = new Map<string, Set<string>>();

  for (const node of nodes) {
    if (node.parentId === null) continue;
    const parent = nodeMap.get(node.parentId);
    if (!parent) continue;

    const pCx = parent.x + parent.width / 2;
    const pCy = parent.y + parent.height / 2;
    const cCx = node.x + node.width / 2;
    const cCy = node.y + node.height / 2;

    const dx = cCx - pCx;
    const dy = cCy - pCy;

    let dir: string;
    if (Math.abs(dx) >= Math.abs(dy)) {
      dir = dx >= 0 ? 'right' : 'left';
    } else {
      dir = dy >= 0 ? 'bottom' : 'top';
    }

    let set = result.get(parent.id);
    if (!set) { set = new Set(); result.set(parent.id, set); }
    set.add(dir);
  }

  return result;
}

/**
 * Worklet-compatible version using plain arrays for hit-testing on the UI thread.
 */
export function computeChildDirsWorklet(
  nodes: MindMapNode[],
): { nodeId: string; dirs: string[] }[] {
  'worklet';
  const nodeMap = new Map<string, MindMapNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const map = new Map<string, Set<string>>();

  for (const node of nodes) {
    if (node.parentId === null) continue;
    const parent = nodeMap.get(node.parentId);
    if (!parent) continue;

    const pCx = parent.x + parent.width / 2;
    const pCy = parent.y + parent.height / 2;
    const cCx = node.x + node.width / 2;
    const cCy = node.y + node.height / 2;

    const dx = cCx - pCx;
    const dy = cCy - pCy;

    let dir: string;
    if (Math.abs(dx) >= Math.abs(dy)) {
      dir = dx >= 0 ? 'right' : 'left';
    } else {
      dir = dy >= 0 ? 'bottom' : 'top';
    }

    let set = map.get(parent.id);
    if (!set) { set = new Set(); map.set(parent.id, set); }
    set.add(dir);
  }

  const result: { nodeId: string; dirs: string[] }[] = [];
  map.forEach((dirs, nodeId) => {
    result.push({ nodeId, dirs: Array.from(dirs) });
  });
  return result;
}

/**
 * Returns the set of node IDs that should be hidden because their parent
 * collapses the direction they're in. Cascades to all descendants.
 */
export function computeHiddenNodes(nodes: MindMapNode[]): Set<string> {
  const nodeMap = new Map<string, MindMapNode>();
  for (const n of nodes) nodeMap.set(n.id, n);

  const hidden = new Set<string>();

  // Build children map
  const childrenMap = new Map<string, MindMapNode[]>();
  for (const node of nodes) {
    if (node.parentId !== null) {
      const arr = childrenMap.get(node.parentId);
      if (arr) arr.push(node);
      else childrenMap.set(node.parentId, [node]);
    }
  }

  function hideSubtree(nodeId: string) {
    hidden.add(nodeId);
    const children = childrenMap.get(nodeId);
    if (children) {
      for (const child of children) hideSubtree(child.id);
    }
  }

  for (const node of nodes) {
    if (node.parentId === null) continue;
    // If parent is already hidden, this node is hidden too
    if (hidden.has(node.parentId)) {
      hideSubtree(node.id);
      continue;
    }
    const parent = nodeMap.get(node.parentId);
    if (!parent) continue;
    const collapsedDirs = parent.collapsedDirs;
    if (!collapsedDirs || collapsedDirs.length === 0) continue;

    // Determine direction of this child relative to parent
    const pCx = parent.x + parent.width / 2;
    const pCy = parent.y + parent.height / 2;
    const cCx = node.x + node.width / 2;
    const cCy = node.y + node.height / 2;
    const dx = cCx - pCx;
    const dy = cCy - pCy;
    let dir: string;
    if (Math.abs(dx) >= Math.abs(dy)) {
      dir = dx >= 0 ? 'right' : 'left';
    } else {
      dir = dy >= 0 ? 'bottom' : 'top';
    }

    if (collapsedDirs.includes(dir)) {
      hideSubtree(node.id);
    }
  }

  return hidden;
}

export function getVisibleNodeIds(
  nodes: MindMapNode[],
  viewportX: number, viewportY: number,
  viewportWidth: number, viewportHeight: number,
  padding: number = 100,
): Set<string> {
  const visible = new Set<string>();
  const left = viewportX - padding, right = viewportX + viewportWidth + padding;
  const top = viewportY - padding, bottom = viewportY + viewportHeight + padding;
  for (const node of nodes) {
    if (node.x + node.width >= left && node.x <= right &&
        node.y + node.height >= top && node.y <= bottom) {
      visible.add(node.id);
    }
  }
  return visible;
}
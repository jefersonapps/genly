import { useCallback, useEffect, useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
    runOnJS,
    useSharedValue,
    withDecay,
    type SharedValue,
} from 'react-native-reanimated';
import { RESIZE_HANDLE_SIZE } from './MindMapCanvas';
import { computeChildDirsWorklet } from './layoutEngine';
import type { MindMapNode } from './useMindMapStore';
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH } from './useMindMapStore';

export interface MapTransform {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
}

export interface DragState {
  dragNodeId: SharedValue<string | null>;
  dragAbsX: SharedValue<number>;
  dragAbsY: SharedValue<number>;
}

export interface ResizeState {
  resizeNodeId: SharedValue<string | null>;
  resizeLiveW: SharedValue<number>;
  resizeLiveH: SharedValue<number>;
}

export interface GestureCallbacks {
  onNodeTap?: (nodeId: string) => void;
  onNodeDoubleTap?: (nodeId: string) => void;
  onBackgroundTap?: () => void;
  onDragStart?: (nodeId: string) => void;
  onDragEnd?: (nodeId: string, absX: number, absY: number) => void;
  onResizeEnd?: (nodeId: string, width: number, height: number) => void;
  onCollapseDirTap?: (nodeId: string, dir: string) => void;
}

// ---------------------------------------------------------------------------
// Worklet hit tests
// ---------------------------------------------------------------------------
function hitTestNodes(worldX: number, worldY: number, nodes: MindMapNode[]): string | null {
  'worklet';
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (worldX >= n.x && worldX <= n.x + n.width &&
        worldY >= n.y && worldY <= n.y + n.height) return n.id;
  }
  return null;
}

function hitTestHandle(worldX: number, worldY: number, nodes: MindMapNode[]): string | null {
  'worklet';
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    const hx = n.x + n.width  - RESIZE_HANDLE_SIZE;
    const hy = n.y + n.height - RESIZE_HANDLE_SIZE;
    if (worldX >= hx && worldX <= n.x + n.width &&
        worldY >= hy && worldY <= n.y + n.height) return n.id;
  }
  return null;
}

const CBTN_R = 9;
const CBTN_OFFSET = 14;
const CBTN_HIT_R = 14; // slightly larger hit area than visual radius

/**
 * Hit-test external collapse buttons. Returns { nodeId, dir } or null.
 */
function hitTestCollapseBtn(
  worldX: number, worldY: number,
  nodes: MindMapNode[],
): { nodeId: string; dir: string } | null {
  'worklet';
  const childDirsList = computeChildDirsWorklet(nodes);

  for (const entry of childDirsList) {
    const node = nodes.find((n) => n.id === entry.nodeId);
    if (!node) continue;
    const w = node.width;
    const h = node.height;

    const positions: { dir: string; cx: number; cy: number }[] = [
      { dir: 'right',  cx: node.x + w + CBTN_OFFSET, cy: node.y + h / 2 },
      { dir: 'left',   cx: node.x - CBTN_OFFSET,     cy: node.y + h / 2 },
      { dir: 'top',    cx: node.x + w / 2,           cy: node.y - CBTN_OFFSET },
      { dir: 'bottom', cx: node.x + w / 2,           cy: node.y + h + CBTN_OFFSET },
    ];

    for (const pos of positions) {
      if (!entry.dirs.includes(pos.dir)) continue;
      const dx = worldX - pos.cx;
      const dy = worldY - pos.cy;
      if (dx * dx + dy * dy <= CBTN_HIT_R * CBTN_HIT_R) {
        return { nodeId: entry.nodeId, dir: pos.dir };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
export function useMapGestures(nodes: MindMapNode[], callbacks: GestureCallbacks) {
  const nodesSV = useSharedValue<MindMapNode[]>(nodes);
  useEffect(() => { nodesSV.value = nodes; }, [nodes, nodesSV]);

  // Map transform
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale      = useSharedValue(1);
  const savedTX    = useSharedValue(0);
  const savedTY    = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const focalWX    = useSharedValue(0);
  const focalWY    = useSharedValue(0);

  // Drag
  const dragNodeId  = useSharedValue<string | null>(null);
  const dragAbsX    = useSharedValue(0);
  const dragAbsY    = useSharedValue(0);
  const dragOriginX = useSharedValue(0);
  const dragOriginY = useSharedValue(0);

  // Resize
  const resizeNodeId  = useSharedValue<string | null>(null);
  const resizeLiveW   = useSharedValue(0);
  const resizeLiveH   = useSharedValue(0);
  const resizeOriginW = useSharedValue(0);
  const resizeOriginH = useSharedValue(0);

  /**
   * Mutual exclusion flag set on long-press start.
   * 0 = nothing active  |  1 = drag active  |  2 = resize active
   * Both gestures use the same activateAfterLongPress duration so only one
   * will find a hit and set the flag; the other bails in onUpdate.
   */
  const activeGesture = useSharedValue<0 | 1 | 2>(0);

  const transform   = useMemo(() => ({ translateX, translateY, scale }), [translateX, translateY, scale]);
  const dragState   = useMemo(() => ({ dragNodeId, dragAbsX, dragAbsY }), [dragNodeId, dragAbsX, dragAbsY]);
  const resizeState = useMemo(() => ({ resizeNodeId, resizeLiveW, resizeLiveH }), [resizeNodeId, resizeLiveW, resizeLiveH]);

  // JS callbacks
  const jsTap        = useCallback((id: string | null) => { if (id) callbacks.onNodeTap?.(id); else callbacks.onBackgroundTap?.(); }, [callbacks]);
  const jsDoubleTap  = useCallback((id: string | null) => { if (id) callbacks.onNodeDoubleTap?.(id); }, [callbacks]);
  const jsDragStart  = useCallback((id: string) => callbacks.onDragStart?.(id), [callbacks]);
  const jsDragEnd    = useCallback((id: string, x: number, y: number) => callbacks.onDragEnd?.(id, x, y), [callbacks]);
  const jsResizeEnd  = useCallback((id: string, w: number, h: number) => callbacks.onResizeEnd?.(id, w, h), [callbacks]);
  const jsCollDir    = useCallback((nodeId: string, dir: string) => callbacks.onCollapseDirTap?.(nodeId, dir), [callbacks]);

  // ---------------------------------------------------------------------------
  // Pan (map scroll) — only activates when no node/resize gesture is running
  // ---------------------------------------------------------------------------
  const panGesture = useMemo(() =>
    Gesture.Pan()
      .minDistance(8).minPointers(1).maxPointers(2)
      .onStart(() => {
        'worklet';
        savedTX.value = translateX.value;
        savedTY.value = translateY.value;
      })
      .onUpdate((e) => {
        'worklet';
        // Don't pan while a node drag or resize is active
        if (activeGesture.value !== 0) return;
        translateX.value = savedTX.value + e.translationX;
        translateY.value = savedTY.value + e.translationY;
      })
      .onEnd((e) => {
        'worklet';
        if (activeGesture.value !== 0) return;
        translateX.value = withDecay({ velocity: e.velocityX, deceleration: 0.994 });
        translateY.value = withDecay({ velocity: e.velocityY, deceleration: 0.994 });
      }),
  [translateX, translateY, savedTX, savedTY, activeGesture]);

  // ---------------------------------------------------------------------------
  // Pinch
  // ---------------------------------------------------------------------------
  const pinchGesture = useMemo(() =>
    Gesture.Pinch()
      .onStart((e) => {
        'worklet';
        savedScale.value = scale.value;
        focalWX.value = (e.focalX - translateX.value) / scale.value;
        focalWY.value = (e.focalY - translateY.value) / scale.value;
      })
      .onUpdate((e) => {
        'worklet';
        const s = Math.min(Math.max(savedScale.value * e.scale, 0.1), 5);
        scale.value = s;
        translateX.value = e.focalX - focalWX.value * s;
        translateY.value = e.focalY - focalWY.value * s;
      }),
  [scale, translateX, translateY, savedScale, focalWX, focalWY]);

  // ---------------------------------------------------------------------------
  // Tap / double-tap
  // ---------------------------------------------------------------------------
  const tapGesture = useMemo(() =>
    Gesture.Tap().maxDuration(250)
      .onEnd((e) => {
        'worklet';
        const wx = (e.x - translateX.value) / scale.value;
        const wy = (e.y - translateY.value) / scale.value;
        // Check collapse buttons FIRST
        const btnHit = hitTestCollapseBtn(wx, wy, nodesSV.value);
        if (btnHit) {
          runOnJS(jsCollDir)(btnHit.nodeId, btnHit.dir);
          return;
        }
        runOnJS(jsTap)(hitTestNodes(wx, wy, nodesSV.value));
      }),
  [translateX, translateY, scale, nodesSV, jsTap, jsCollDir]);

  const doubleTapGesture = useMemo(() =>
    Gesture.Tap().numberOfTaps(2).maxDuration(300)
      .onEnd((e) => {
        'worklet';
        const wx = (e.x - translateX.value) / scale.value;
        const wy = (e.y - translateY.value) / scale.value;
        runOnJS(jsDoubleTap)(hitTestNodes(wx, wy, nodesSV.value));
      }),
  [translateX, translateY, scale, nodesSV, jsDoubleTap]);

  // ---------------------------------------------------------------------------
  // Node drag — long press, skips if touch is on a resize handle
  // ---------------------------------------------------------------------------
  const nodeDragGesture = useMemo(() =>
    Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart((e) => {
        'worklet';
        const wx = (e.x - translateX.value) / scale.value;
        const wy = (e.y - translateY.value) / scale.value;

        // If touching the resize handle, let the resize gesture own this
        if (hitTestHandle(wx, wy, nodesSV.value) !== null) return;

        const hitId = hitTestNodes(wx, wy, nodesSV.value);
        if (!hitId) return;

        const node = nodesSV.value.find((n) => n.id === hitId);
        if (!node) return;

        activeGesture.value = 1;
        dragOriginX.value = node.x;
        dragOriginY.value = node.y;
        dragAbsX.value    = node.x;
        dragAbsY.value    = node.y;
        dragNodeId.value  = hitId;
        runOnJS(jsDragStart)(hitId);
        runOnJS(jsTap)(hitId);
      })
      .onUpdate((e) => {
        'worklet';
        if (activeGesture.value !== 1) return;
        dragAbsX.value = dragOriginX.value + e.translationX / scale.value;
        dragAbsY.value = dragOriginY.value + e.translationY / scale.value;
      })
      .onEnd(() => {
        'worklet';
        if (activeGesture.value !== 1) return;
        const id = dragNodeId.value;
        activeGesture.value = 0;
        if (id !== null) runOnJS(jsDragEnd)(id, dragAbsX.value, dragAbsY.value);
      })
      .onFinalize(() => {
        'worklet';
        if (activeGesture.value === 1) activeGesture.value = 0;
      }),
  [
    translateX, translateY, scale, nodesSV, activeGesture,
    dragNodeId, dragAbsX, dragAbsY, dragOriginX, dragOriginY,
    jsTap, jsDragStart, jsDragEnd,
  ]);

  // ---------------------------------------------------------------------------
  // Resize — long press on handle corner
  // ---------------------------------------------------------------------------
  const resizeGesture = useMemo(() =>
    Gesture.Pan()
      .activateAfterLongPress(400)
      .onStart((e) => {
        'worklet';
        const wx = (e.x - translateX.value) / scale.value;
        const wy = (e.y - translateY.value) / scale.value;

        const hitId = hitTestHandle(wx, wy, nodesSV.value);
        if (!hitId) return;

        const node = nodesSV.value.find((n) => n.id === hitId);
        if (!node) return;

        activeGesture.value = 2;
        resizeOriginW.value = node.width;
        resizeOriginH.value = node.height;
        resizeLiveW.value   = node.width;
        resizeLiveH.value   = node.height;
        resizeNodeId.value  = hitId;
        runOnJS(jsTap)(hitId);
      })
      .onUpdate((e) => {
        'worklet';
        if (activeGesture.value !== 2) return;

        const newW = Math.max(NODE_MIN_WIDTH, resizeOriginW.value + e.translationX / scale.value);

        // Approximate min height so text never clips vertically.
        // We can't use the Skia font here, so we use char-width estimation
        // (same approximation as the JS-side layoutEngine).
        const APPROX_CW = 13 * 0.58;
        const LINE_H    = 13 * 1.55;
        const V_PAD     = 10;
        const H_PAD     = 16;
        const maxTextW  = newW - H_PAD * 2;
        const id = resizeNodeId.value;
        const resizingNode = id !== null
          ? nodesSV.value.find((n: MindMapNode) => n.id === id)
          : null;
        const title = resizingNode ? resizingNode.title : '';
        const words = title.split(' ');
        let lineCount = 1;
        let cur = '';
        for (let wi = 0; wi < words.length; wi++) {
          const word = words[wi];
          const wordW = word.length * APPROX_CW;
          if (wordW > maxTextW) {
            if (cur) { lineCount++; cur = ''; }
            lineCount += Math.ceil(wordW / maxTextW) - 1;
          } else {
            const joined = cur ? cur + ' ' + word : word;
            if (joined.length * APPROX_CW > maxTextW && cur) {
              lineCount++;
              cur = word;
            } else {
              cur = joined;
            }
          }
        }
        const minH = Math.max(NODE_MIN_HEIGHT, Math.ceil(lineCount * LINE_H + V_PAD * 2));

        resizeLiveW.value = newW;
        resizeLiveH.value = Math.max(minH, resizeOriginH.value + e.translationY / scale.value);
      })
      .onEnd(() => {
        'worklet';
        if (activeGesture.value !== 2) return;
        const id = resizeNodeId.value;
        activeGesture.value = 0;
        if (id !== null) {
          runOnJS(jsResizeEnd)(id, resizeLiveW.value, resizeLiveH.value);
        }
      })
      .onFinalize(() => {
        'worklet';
        if (activeGesture.value === 2) activeGesture.value = 0;
      }),
  [
    translateX, translateY, scale, nodesSV, activeGesture,
    resizeNodeId, resizeLiveW, resizeLiveH, resizeOriginW, resizeOriginH,
    jsTap, jsResizeEnd,
  ]);

  // ---------------------------------------------------------------------------
  // Composed — Simultaneous so both gestures can receive the same touch stream;
  // mutual exclusion is handled via activeGesture flag, not by Race/Exclusive.
  // ---------------------------------------------------------------------------
  const composed = useMemo(() =>
    Gesture.Race(
      // Node-level gestures run simultaneously so both see touch events
      Gesture.Simultaneous(nodeDragGesture, resizeGesture),
      Gesture.Simultaneous(panGesture, pinchGesture),
      Gesture.Exclusive(doubleTapGesture, tapGesture),
    ),
  [nodeDragGesture, resizeGesture, panGesture, pinchGesture, doubleTapGesture, tapGesture]);

  const forceClearDrag = useCallback(() => {
    dragNodeId.value    = null;
    activeGesture.value = 0;
  }, [dragNodeId, activeGesture]);

  return { gesture: composed, transform, dragState, resizeState, forceClearDrag };
}
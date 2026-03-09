import {
  Canvas,
  Group,
  Image,
  Path,
  Picture,
  Rect,
  Skia,
  Text as SkiaText,
  useFont,
  useImage,
  type SkFont
} from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { computeEdges } from './layoutEngine';
import type { DragState, ResizeState } from './useMapGestures';
import type { BackgroundPattern, MindMapNode } from './useMindMapStore';

// Collapse button constants
const CBTN_R = 9;
const CBTN_OFFSET = 14;

// ---------------------------------------------------------------------------
// BackgroundLayer
// ---------------------------------------------------------------------------
const BackgroundLayer = React.memo(function BackgroundLayer({
  isDark,
  canvasBgColor,
  bgPattern,
  translateX,
  translateY,
  scale,
}: {
  isDark: boolean;
  canvasBgColor: string | null;
  bgPattern: BackgroundPattern;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
}) {
  const { width: scrW, height: scrH } = useWindowDimensions();
  // Use a generous size to cover all pans/zooms before the grid calculation
  const w = Math.max(scrW, 4000);
  const h = Math.max(scrH, 4000);

  const bgColor = canvasBgColor || (isDark ? '#09090B' : '#FAFAFA'); // matching app backgrounds
  const isBgDark = hexLuminance(bgColor) < 0.5;
  const patternColor = isBgDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
  const patternColorStrong = isBgDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

  const gridPath = useDerivedValue(() => {
    'worklet';
    const path = Skia.Path.Make();
    if (bgPattern === 'none' || bgPattern === 'dots') return path;
    
    const BASE_SIZE = 40;
    const s = scale.value;
    const size = BASE_SIZE * s;
    const tx = translateX.value;
    const ty = translateY.value;
    
    // Calculate the first line position off-screen
    const startX = (tx % size) - size;
    const startY = (ty % size) - size;
    
    if (bgPattern === 'grid' || bgPattern === 'lines') {
      for (let y = startY; y < h + size; y += size) {
        path.moveTo(0, y);
        path.lineTo(w, y);
      }
    }
    
    if (bgPattern === 'grid') {
      for (let x = startX; x < w + size; x += size) {
        path.moveTo(x, 0);
        path.lineTo(x, h);
      }
    }
    return path;
  });

  const dotsPicture = useDerivedValue(() => {
     'worklet';
     const recorder = Skia.PictureRecorder();
     const cvs = recorder.beginRecording(Skia.XYWHRect(0, 0, w, h));
     
     if (bgPattern === 'dots') {
       const paint = Skia.Paint();
       paint.setColor(Skia.Color(patternColorStrong));
       paint.setAntiAlias(true);
       
       const s = scale.value;
       const size = 40 * s;
       const radius = 2 * s;
       const tx = translateX.value;
       const ty = translateY.value;
       
       const startX = (tx % size) - size;
       const startY = (ty % size) - size;
       
       for (let x = startX; x < w + size; x += size) {
         for (let y = startY; y < h + size; y += size) {
            cvs.drawCircle(x, y, radius, paint);
         }
       }
     }
     return recorder.finishRecordingAsPicture();
  });

  return (
    <Group>
       {/* Background solid color */}
       <Rect x={-2000} y={-2000} width={w + 4000} height={h + 4000} color={bgColor} />
       
       {/* Grid or Lines */}
       {bgPattern !== 'dots' && bgPattern !== 'none' && (
         <Path path={gridPath} style="stroke" strokeWidth={1} color={patternColor} />
       )}

       {/* Dots */}
       {bgPattern === 'dots' && (
         <Picture picture={dotsPicture} />
       )}
    </Group>
  );
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
export const RESIZE_HANDLE_SIZE = 22;
const HANDLE_VISUAL_R = 5;
const FONT_SIZE = 13;
const LINE_HEIGHT_FACTOR = 1.5;
const LINE_HEIGHT = FONT_SIZE * LINE_HEIGHT_FACTOR;
const H_PAD = 16;
const V_PAD = 16;
const APPROX_CHAR_W = FONT_SIZE * 0.60;

// ---------------------------------------------------------------------------
// Worklet helpers
// ---------------------------------------------------------------------------
function hexLuminance(hex: string): number {
  'worklet';
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Parse a hex color to RGB components (0-255) */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  'worklet';
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.substring(0, 2), 16),
    g: parseInt(c.substring(2, 4), 16),
    b: parseInt(c.substring(4, 6), 16),
  };
}

/** Lighten a hex color by mixing towards white. factor 0 = no change, 1 = white */
function lightenHex(hex: string, factor: number): string {
  'worklet';
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  const toHex = (v: number) => {
    const s = v.toString(16);
    return s.length < 2 ? '0' + s : s;
  };
  return '#' + toHex(lr) + toHex(lg) + toHex(lb);
}

/** Darken a hex color by mixing towards black. factor 0 = no change, 1 = black */
function darkenHex(hex: string, factor: number): string {
  'worklet';
  const { r, g, b } = hexToRgb(hex);
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  const toHex = (v: number) => {
    const s = v.toString(16);
    return s.length < 2 ? '0' + s : s;
  };
  return '#' + toHex(dr) + toHex(dg) + toHex(db);
}

/** Create an rgba string from a hex color with given alpha */
function hexWithAlpha(hex: string, alpha: number): string {
  'worklet';
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getNodeBgColor(depth: number, isDark: boolean, customColor?: string): string {
  'worklet';
  if (customColor) return customColor;
  if (depth === 0) return isDark ? '#2563EB' : '#3B82F6';
  if (depth === 1) return isDark ? '#1E293B' : '#F0F4FF';
  return isDark ? '#1A1A2E' : '#FAFBFF';
}
function getNodeBorderColor(depth: number, isDark: boolean, customColor?: string): string {
  'worklet';
  if (customColor) return darkenHex(customColor, 0.25);
  if (depth === 0) return isDark ? '#3B82F6' : '#2563EB';
  // Use solid colors for stroke instead of rgba to avoid blending issues in Skia on Android
  return isDark ? '#333344' : '#E2E8F0';
}
function getNodeTextColor(depth: number, isDark: boolean, customColor?: string): string {
  'worklet';
  if (customColor) return hexLuminance(customColor) > 0.5 ? '#1F2937' : '#FFFFFF';
  if (depth === 0) return '#FFFFFF';
  return isDark ? '#E5E7EB' : '#1F2937';
}

function wrapText(title: string, maxW: number, font: SkFont | null): string[] {
  'worklet';
  if (maxW <= 0) return [title || ''];
  const measure = (s: string) =>
    font ? font.measureText(s).width : s.length * APPROX_CHAR_W;

  const result: string[] = [];
  const rawLines = (title || 'Sem título').split('\r').join('').split('\n');

  for (const line of rawLines) {
    if (line === '') {
      result.push('');
      continue;
    }
    const words = line.split(' ');
    let currentLine = '';

    for (const word of words) {
      if (measure(word) > maxW) {
        if (currentLine) result.push(currentLine);
        currentLine = '';
        
        let buf = '';
        for (let i = 0; i < word.length; i++) {
          const char = word[i];
          const next = buf + char;
          if (measure(next) > maxW && buf.length > 0) {
            result.push(buf);
            buf = char;
          } else {
            buf = next;
          }
        }
        currentLine = buf;
        continue;
      }

      const joined = currentLine ? `${currentLine} ${word}` : word;
      if (measure(joined) <= maxW) {
        currentLine = joined;
      } else {
        result.push(currentLine);
        currentLine = word;
      }
    }
    result.push(currentLine);
  }
  
  return result.length ? result : [''];
}

/** Minimum height to fit all wrapped lines without overflow */
function minHeightForText(title: string, w: number, font: SkFont | null): number {
  'worklet';
  const lines = wrapText(title, w - H_PAD * 2, font);
  return lines.length * LINE_HEIGHT + V_PAD * 2;
}

// ---------------------------------------------------------------------------
// Edge layer — geometry only, safe worklet
// ---------------------------------------------------------------------------
const EdgeLayer = React.memo(function EdgeLayer({
  nodes, isDark, dragState, resizeState, hiddenNodes,
}: {
  nodes: MindMapNode[];
  isDark: boolean;
  dragState: DragState;
  resizeState: ResizeState;
  hiddenNodes: Set<string>;
}) {
  const collapsedSet = useMemo(
    () => new Set(nodes.filter((n) => n.collapsed).map((n) => n.id)), [nodes],
  );
  const edgeColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';

  const hiddenArr = useMemo(() => Array.from(hiddenNodes), [hiddenNodes]);

  const edgesPath = useDerivedValue(() => {
    'worklet';
    const hiddenSet = new Set(hiddenArr);
    const dragId   = dragState.dragNodeId.value;
    const resizeId = resizeState.resizeNodeId.value;
    const live = nodes.map((n: MindMapNode) => {
      if (n.id === dragId)   return { ...n, x: dragState.dragAbsX.value, y: dragState.dragAbsY.value };
      if (n.id === resizeId) return {
        ...n,
        width:  Math.max(120, resizeState.resizeLiveW.value),
        height: Math.max(44, resizeState.resizeLiveH.value),
      };
      return n;
    });
    const edges = computeEdges(live, collapsedSet);
    const path = Skia.Path.Make();
    for (const e of edges) {
      // Skip edges to hidden children
      if (hiddenSet.has(e.childId)) continue;
      path.moveTo(e.fromX, e.fromY);
      if (e.direction === 'top' || e.direction === 'bottom') {
        const cpY = Math.abs(e.toY - e.fromY) * 0.45;
        path.cubicTo(e.fromX, e.fromY + (e.direction === 'bottom' ? cpY : -cpY),
                     e.toX,   e.toY   + (e.direction === 'bottom' ? -cpY : cpY),
                     e.toX,   e.toY);
      } else {
        const sign = e.direction === 'right' ? 1 : -1;
        const cpX = Math.abs(e.toX - e.fromX) * 0.45;
        path.cubicTo(e.fromX + sign * cpX, e.fromY,
                     e.toX   - sign * cpX, e.toY,
                     e.toX,                e.toY);
      }
    }
    return path;
  });

  return <Path path={edgesPath} style="stroke" strokeWidth={2} color={edgeColor} strokeCap="round" />;
});

// ---------------------------------------------------------------------------
// NodeShell — background, border, external collapse buttons, resize handle
// Drawn via SkPicture worklet (pure geometry, no text font issues)
// ---------------------------------------------------------------------------
const NodeShell = React.memo(function NodeShell({
  node, isSelected,
  primaryColor, isDark, resizeState,
  childDirs, collapsedDirs,
}: {
  node: MindMapNode;
  isSelected: boolean;
  primaryColor: string;
  isDark: boolean;
  resizeState: ResizeState;
  childDirs: string[];   // directions that have children
  collapsedDirs: string[]; // directions currently collapsed
}) {
  const picture = useDerivedValue(() => {
    'worklet';

    const w = resizeState.resizeNodeId.value === node.id
      ? Math.max(120, resizeState.resizeLiveW.value) : node.width;
    const h = resizeState.resizeNodeId.value === node.id
      ? Math.max(44, resizeState.resizeLiveH.value)  : node.height;

    // Expand bounds for external collapse buttons
    const recorder = Skia.PictureRecorder();
    const cvs      = recorder.beginRecording(
      Skia.XYWHRect(-CBTN_OFFSET - CBTN_R - 2, -CBTN_OFFSET - CBTN_R - 2,
        w + (CBTN_OFFSET + CBTN_R + 2) * 2, h + (CBTN_OFFSET + CBTN_R + 2) * 2));

    const fillP   = Skia.Paint(); fillP.setStyle(0);   fillP.setAntiAlias(true); // 0 = Fill
    const strokeP = Skia.Paint(); strokeP.setStyle(1); strokeP.setAntiAlias(true); // 1 = Stroke

    const rrect = Skia.RRectXY(Skia.XYWHRect(0, 0, w, h), 12, 12);

    // Background — when selected, use a lightened version of the bg color
    const bgHex = getNodeBgColor(node.depth, isDark, node.color);
    const bgColor = isSelected ? lightenHex(bgHex, 0.18) : bgHex;
    fillP.setColor(Skia.Color(bgColor));
    cvs.drawRRect(rrect, fillP);

    // Border — when selected, use a ring matching the bg color
    if (isSelected) {
      const isDarkBg = hexLuminance(bgHex) < 0.5;
      const ringColor = isDarkBg ? lightenHex(bgHex, 0.45) : darkenHex(bgHex, 0.35);
      strokeP.setColor(Skia.Color(ringColor));
      strokeP.setStrokeWidth(2);
    } else {
      strokeP.setColor(Skia.Color(getNodeBorderColor(node.depth, isDark, node.color)));
      strokeP.setStrokeWidth(1);
    }
    cvs.drawRRect(rrect, strokeP);

    // External collapse buttons at each edge that has children
    const btnBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
    const btnStroke = isDark ? '#9CA3AF' : '#6B7280';
    const positions: { dir: string; cx: number; cy: number }[] = [
      { dir: 'right',  cx: w + CBTN_OFFSET, cy: h / 2 },
      { dir: 'left',   cx: -CBTN_OFFSET,    cy: h / 2 },
      { dir: 'top',    cx: w / 2,           cy: -CBTN_OFFSET },
      { dir: 'bottom', cx: w / 2,           cy: h + CBTN_OFFSET },
    ];
    for (const pos of positions) {
      if (!childDirs.includes(pos.dir)) continue;
      const isCollapsed = collapsedDirs.includes(pos.dir);
      // Circle background
      fillP.setColor(Skia.Color(btnBg));
      cvs.drawCircle(pos.cx, pos.cy, CBTN_R, fillP);
      // Circle border
      strokeP.setColor(Skia.Color(isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)'));
      strokeP.setStrokeWidth(1);
      cvs.drawCircle(pos.cx, pos.cy, CBTN_R, strokeP);
      // Draw "+" or "−" symbol
      strokeP.setColor(Skia.Color(btnStroke));
      strokeP.setStrokeWidth(1.5);
      // Horizontal bar (always drawn)
      cvs.drawLine(pos.cx - 4, pos.cy, pos.cx + 4, pos.cy, strokeP);
      // Vertical bar (only for "+")
      if (isCollapsed) {
        cvs.drawLine(pos.cx, pos.cy - 4, pos.cx, pos.cy + 4, strokeP);
      }
    }

    // Resize handle — diagonal grip lines
    const rPad = 6;
    const rLen = 10;
    const rx = w - rPad;
    const ry = h - rPad;
    strokeP.setColor(Skia.Color(isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'));
    strokeP.setStrokeWidth(1.5);
    cvs.drawLine(rx, ry - rLen, rx - rLen, ry, strokeP);
    cvs.drawLine(rx, ry - rLen * 0.55, rx - rLen * 0.55, ry, strokeP);
    cvs.drawLine(rx, ry - rLen * 0.15, rx - rLen * 0.15, ry, strokeP);

    return recorder.finishRecordingAsPicture();
  });

  return <Picture picture={picture} />;
});

const NodeImage = React.memo(function NodeImage({ 
  uri, x, y, width, height, opacity 
}: { 
  uri: string, x: any, y: any, width: any, height: any, opacity: any 
}) {
  const image = useImage(uri);
  const clip = useDerivedValue(() => {
    'worklet';
    return Skia.RRectXY(Skia.XYWHRect(x.value, y.value, width.value, height.value), 12, 12);
  }, [x, y, width, height]);

  if (!image) return null;
  return (
    <Group clip={clip}>
      <Image image={image} x={x} y={y} width={width} height={height} fit="cover" opacity={opacity} />
    </Group>
  );
});

const MAX_LINES = 15;

/** Single line of text within a node */
const SingleLine = React.memo(function SingleLine({
  index, allLines, font, textColor, textOpacity, node, resizeState
}: {
  index: number;
  allLines: any;
  font: SkFont;
  textColor: string;
  textOpacity: any;
  node: MindMapNode;
  resizeState: ResizeState;
}) {
  const x = useDerivedValue(() => {
    'worklet';
    const lines = allLines.value.lines || [];
    if (!lines || index >= lines.length) return 0;
    const lineStr = lines[index]?.text || '';
    
    const align = node.textAlign || 'center';
    if (align === 'left') return H_PAD;
    
    const w = resizeState.resizeNodeId.value === node.id
      ? Math.max(120, resizeState.resizeLiveW.value) : node.width;
    
    const lineWidth = font.measureText(lineStr).width;
    if (align === 'center') return (w - lineWidth) / 2;
    return w - H_PAD - lineWidth;
  }, [node]);

  const y = useDerivedValue(() => {
    'worklet';
    const lines = allLines.value.lines || [];
    return index < lines.length ? lines[index].y : 0;
  });

  const t = useDerivedValue(() => {
    'worklet';
    const lines = allLines.value.lines || [];
    return index < lines.length ? lines[index].text : '';
  });

  const opacity = useDerivedValue(() => {
    'worklet';
    const lines = allLines.value.lines || [];
    const visible = index < lines.length;
    return (visible ? 1 : 0) * textOpacity.value;
  });

  return (
    <SkiaText x={x} y={y} text={t} font={font} color={textColor} opacity={opacity} />
  );
});

// ---------------------------------------------------------------------------
// NodeText — rendered using Skia's JSX Text components (correct font fill)
// Positions recompute via useDerivedValue when live size changes
// ---------------------------------------------------------------------------
const NodeText = React.memo(function NodeText({
  node, isDark, resizeState, font, isEditing,
}: {
  node: MindMapNode;
  isDark: boolean;
  resizeState: ResizeState;
  font: SkFont;
  isEditing?: boolean;
}) {
  const textColor = getNodeTextColor(node.depth, isDark, node.color);

  // If we are editing this node inline, hide the Skia text to avoid overlap with TextInput
  const textOpacity = useDerivedValue(() => isEditing ? 0 : 1, [isEditing]);

  /**
   * Compute wrapped lines + Y positions as a derived value (worklet).
   * To avoid reading .value in JSX we use a trick: render a fixed max
   * number of SkiaText slots (up to MAX_LINES) and use opacity 0 for
   * unused slots. Each slot reads only its own derived value.
   */
  const allLines = useDerivedValue(() => {
    'worklet';
    const w = resizeState.resizeNodeId.value === node.id
      ? Math.max(120, resizeState.resizeLiveW.value) : node.width;
    const h = resizeState.resizeNodeId.value === node.id
      ? Math.max(44, resizeState.resizeLiveH.value)  : node.height;

    const lines = wrapText(node.title, w - H_PAD * 2, font);
    // Use full line height for each line to match TextInput content centering
    const totalTextH = lines.length * LINE_HEIGHT;
    
    let totalContentH = totalTextH;
    let imgH = 0;
    if (node.imageUri && node.imageAspectRatio) {
      const imgW = w - H_PAD * 2;
      imgH = imgW / node.imageAspectRatio;
      totalContentH += imgH + 16; 
    }

    const firstLineTop = (h - totalContentH) / 2;
    // Standard baseline offset: 
    // center the font box (FONT_SIZE) within the line-height box (LINE_HEIGHT)
    const lineMargin = (LINE_HEIGHT - FONT_SIZE) / 2;
    // baseline is ~0.8 * font size from the top of the font box
    const firstLineBaseline = firstLineTop + lineMargin + (FONT_SIZE * 0.8) - 1;
    
    return {
      lines: lines.map((text, i) => ({
        text,
        y: firstLineBaseline + i * LINE_HEIGHT
      })),
      imageY: firstLineTop + totalTextH + 16,
      imageH: imgH,
      imageW: w - H_PAD * 2
    };
  }, [node]);

  const imgX = useDerivedValue(() => H_PAD, [node]);
  const imgY = useDerivedValue(() => allLines.value.imageY, [node]);
  const imgW = useDerivedValue(() => allLines.value.imageW, [node]);
  const imgH = useDerivedValue(() => allLines.value.imageH, [node]);

  return (
    <>
      {Array.from({ length: MAX_LINES }).map((_, i) => (
        <SingleLine
          key={i}
          index={i}
          allLines={allLines}
          font={font}
          textColor={textColor}
          textOpacity={textOpacity}
          node={node}
          resizeState={resizeState}
        />
      ))}
      {node.imageUri && (
        <NodeImage
          uri={node.imageUri}
          x={imgX}
          y={imgY}
          width={imgW}
          height={imgH}
          opacity={1}
        />
      )}
    </>
  );
});

// ---------------------------------------------------------------------------
// NodeItem
// ---------------------------------------------------------------------------
const NodeItem = React.memo(function NodeItem({
  node, isSelected, isEditing,
  primaryColor, isDark, dragState, resizeState, font,
  childDirs, collapsedDirs,
}: {
  node: MindMapNode;
  isSelected: boolean;
  isEditing: boolean;
  primaryColor: string;
  isDark: boolean;
  dragState: DragState;
  resizeState: ResizeState;
  font: SkFont | null;
  childDirs: string[];
  collapsedDirs: string[];
}) {
  const nodeTransform = useDerivedValue(() => {
    'worklet';
    if (dragState.dragNodeId.value === node.id) {
      return [{ translateX: dragState.dragAbsX.value }, { translateY: dragState.dragAbsY.value }];
    }
    return [{ translateX: node.x }, { translateY: node.y }];
  }, [node]);

  return (
    <Group transform={nodeTransform}>
      <NodeShell
        node={node} isSelected={isSelected}
        primaryColor={primaryColor} isDark={isDark}
        resizeState={resizeState}
        childDirs={childDirs}
        collapsedDirs={collapsedDirs}
      />
      {font && (
        <NodeText
          node={node} isDark={isDark}
          resizeState={resizeState} font={font}
          isEditing={isEditing}
        />
      )}
    </Group>
  );
});

// ---------------------------------------------------------------------------
// NodeLayer
// ---------------------------------------------------------------------------
const NodeLayer = React.memo(function NodeLayer({
  nodes, selectedId, editingId, primaryColor, isDark, dragState, resizeState, font,
  childDirsMap, hiddenNodes,
}: {
  nodes: MindMapNode[];
  selectedId: string | null;
  editingId: string | null;
  primaryColor: string;
  isDark: boolean;
  dragState: DragState;
  resizeState: ResizeState;
  font: SkFont | null;
  childDirsMap: Map<string, Set<string>>;
  hiddenNodes: Set<string>;
}) {
  const visibleNodes = useMemo(
    () => nodes.filter((n) => !hiddenNodes.has(n.id)),
    [nodes, hiddenNodes],
  );

  return (
    <>
      {visibleNodes.map((node) => {
        const dirs = childDirsMap.get(node.id);
        const childDirs = dirs ? Array.from(dirs) : [];
        const collapsedDirs = node.collapsedDirs ?? [];
        return (
          <NodeItem
            key={node.id} node={node}
            isSelected={node.id === selectedId}
            isEditing={node.id === editingId}
            primaryColor={primaryColor} isDark={isDark}
            dragState={dragState} resizeState={resizeState}
            font={font}
            childDirs={childDirs}
            collapsedDirs={collapsedDirs}
          />
        );
      })}
    </>
  );
});

// ---------------------------------------------------------------------------
// Canvas root
// ---------------------------------------------------------------------------
export interface MindMapCanvasProps {
  nodes: MindMapNode[];
  selectedId: string | null;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  editingId?: string | null;
  primaryColor: string;
  isDark: boolean;
  dragState: DragState;
  resizeState: ResizeState;
  childDirsMap: Map<string, Set<string>>;
  hiddenNodes: Set<string>;
  canvasBgColor: string | null;
  bgPattern: BackgroundPattern;
}

export const MindMapCanvas = React.memo(function MindMapCanvas({
  nodes, selectedId, editingId,
  translateX, translateY, scale,
  primaryColor, isDark,
  dragState, resizeState,
  childDirsMap, hiddenNodes,
  canvasBgColor, bgPattern,
}: MindMapCanvasProps) {
  const font = useFont(require('../../../assets/fonts/Montserrat-SemiBold.ttf'), FONT_SIZE);

  const mapTransform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  const bgColor = canvasBgColor || (isDark ? '#09090B' : '#FAFAFA');
  const isBgDark = hexLuminance(bgColor) < 0.5;

  return (
    <Canvas style={{ flex: 1 }}>
      <BackgroundLayer
         isDark={isDark}
         canvasBgColor={canvasBgColor}
         bgPattern={bgPattern}
         translateX={translateX}
         translateY={translateY}
         scale={scale}
      />
      <Group transform={mapTransform}>
        <EdgeLayer nodes={nodes} isDark={isBgDark} dragState={dragState} resizeState={resizeState} hiddenNodes={hiddenNodes} />
        <NodeLayer
          nodes={nodes} selectedId={selectedId} editingId={editingId ?? null}
          primaryColor={primaryColor} isDark={isBgDark}
          dragState={dragState} resizeState={resizeState}
          font={font}
          childDirsMap={childDirsMap}
          hiddenNodes={hiddenNodes}
        />
      </Group>
    </Canvas>
  );
});
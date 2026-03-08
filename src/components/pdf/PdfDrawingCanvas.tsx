import type { Annotation } from '@/lib/pdfEditor/usePdfEditorStore';
import {
  Canvas,
  Circle,
  Group,
  Skia,
  Path as SkiaPath,
} from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  type SharedValue
} from 'react-native-reanimated';

interface PdfDrawingCanvasProps {
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  existingDrawings: Annotation[];
  onPathComplete: (pathData: string) => void;
  interactive?: boolean;
  activeTool?: 'brush' | 'eraser' | 'text' | 'image' | null;
  onErase?: (id: string) => void;
  canvasScale?: SharedValue<number>;
}

export function PdfDrawingCanvas({
  width,
  height,
  strokeColor,
  strokeWidth,
  existingDrawings,
  onPathComplete,
  interactive = true,
  activeTool = 'brush',
  onErase,
  canvasScale,
}: PdfDrawingCanvasProps) {
  // Local temporary paths to avoid flicker before store updates
  const [localPaths, setLocalPaths] = useState<{ path: string; color: string; width: number }[]>([]);
  
  const activePath = useSharedValue<ReturnType<typeof Skia.Path.Make> | null>(null);
  const prevPoint = useSharedValue<{ x: number; y: number } | null>(null);
  const prevEraserPoint = useSharedValue<{ x: number; y: number } | null>(null);
  
  // Eraser visual indicator states
  const eraserX = useSharedValue(-100);
  const eraserY = useSharedValue(-100);
  const showEraser = useSharedValue(0);
  
  // Caching erased IDs for the current gesture to avoid bridge flooding
  const erasedIdsInGesture = useSharedValue<string[]>([]);

  // Clear local paths if external state (like Undo/Redo) changes the drawings array
  useEffect(() => {
    setLocalPaths((prev) => prev.length > 0 ? [] : prev);
  }, [existingDrawings]);
  
  // Pre-calculated hit paths for eraser performance (on UI thread)
  const hitPaths = useSharedValue<{ id: string; hitPath: ReturnType<typeof Skia.Path.Make> }[]>([]);

  // Update hit paths ONLY when drawings or tool changes.
  // CRITICAL: No .value in dependency array to avoid Reanimated warnings.
  useEffect(() => {
    if (activeTool === 'eraser') {
      const calculated = existingDrawings.map((ann) => {
        if (!ann.pathData || typeof ann.pathData !== 'string') return null;
        try {
          const path = Skia.Path.MakeFromSVGString(ann.pathData);
          if (!path) return null;
          // Ultra-generous world buffer (80 units) for perfect hit detection
          const stroked = path.stroke({ width: (ann.strokeWidth || 3) + 80, cap: 1, join: 1 });
          return stroked ? { id: ann.id, hitPath: stroked } : null;
        } catch (e) {
          return null;
        }
      }).filter(Boolean) as { id: string; hitPath: ReturnType<typeof Skia.Path.Make> }[];
      hitPaths.value = calculated;
    } else {
      hitPaths.value = [];
    }
  }, [existingDrawings, activeTool]);

  const onPathCompleteJS = useCallback((svgStr: string) => {
    onPathComplete(svgStr);
    setLocalPaths(prev => [...prev, { path: svgStr, color: strokeColor, width: strokeWidth }]);
    // Fix: Wait for React to paint the new localPaths state before clearing the active path
    requestAnimationFrame(() => {
      setTimeout(() => {
        activePath.value = null;
      }, 50); // Small buffer to ensure Skia renders the new path
    });
  }, [onPathComplete, strokeColor, strokeWidth, activePath]);

  const onEraseJS = useCallback((id: string) => {
    if (onErase) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onErase(id);
      // Clear ghost local paths so erased strokes don't persist visually
      setLocalPaths([]);
    }
  }, [onErase]);

  const drawGesture = Gesture.Pan()
    .minDistance(1)
    .maxPointers(1)
    .onStart((e) => {
      'worklet';
      if (activeTool === 'eraser') {
        eraserX.value = e.x;
        eraserY.value = e.y;
        showEraser.value = 1;
        prevEraserPoint.value = { x: e.x, y: e.y };
        erasedIdsInGesture.value = [];
      } else if (activeTool === 'brush') {
        const path = Skia.Path.Make();
        path.moveTo(e.x, e.y);
        activePath.value = path;
        prevPoint.value = { x: e.x, y: e.y };
      }
    })
    .onUpdate((e) => {
      'worklet';
      if (activeTool === 'eraser') {
        eraserX.value = e.x;
        eraserY.value = e.y;
        
        if (prevEraserPoint.value) {
          const dx = e.x - prevEraserPoint.value.x;
          const dy = e.y - prevEraserPoint.value.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Fixed physical sampling (approx 5px on screen)
          const currentScale = canvasScale ? canvasScale.value : 1;
          const sampleStep = 5 / currentScale;
          const steps = Math.max(1, Math.ceil(dist / sampleStep));
          
          const alreadyErased = [...erasedIdsInGesture.value];
          let listUpdated = false;
          
          for (let s = 0; s <= steps; s++) {
            const sx = prevEraserPoint.value.x + (dx * s) / steps;
            const sy = prevEraserPoint.value.y + (dy * s) / steps;
            
            // Fix Bug 2: Read hitPaths.value fresh each iteration
            // so mid-gesture deletions don't leave stale Skia path refs
            const freshPaths = hitPaths.value;
            if (freshPaths.length === 0) break;
            
            for (let i = 0; i < freshPaths.length; i++) {
              const item = freshPaths[i];
              if (!item || !item.id || !item.hitPath) continue;

              let found = false;
              for (let j = 0; j < alreadyErased.length; j++) {
                if (alreadyErased[j] === item.id) {
                  found = true;
                  break;
                }
              }
              
              if (!found && item.hitPath.contains(sx, sy)) {
                runOnJS(onEraseJS)(item.id);
                alreadyErased.push(item.id);
                listUpdated = true;
              }
            }
          }
          if (listUpdated) {
            erasedIdsInGesture.value = alreadyErased;
          }
        }
        prevEraserPoint.value = { x: e.x, y: e.y };
      } else if (activeTool === 'brush' && activePath.value && prevPoint.value) {
        const path = activePath.value.copy();
        const midX = (prevPoint.value.x + e.x) / 2;
        const midY = (prevPoint.value.y + e.y) / 2;
        path.quadTo(prevPoint.value.x, prevPoint.value.y, midX, midY);
        activePath.value = path;
        prevPoint.value = { x: e.x, y: e.y };
      }
    })
    .onEnd(() => {
      'worklet';
      showEraser.value = 0;
      prevEraserPoint.value = null;
      
      if (activeTool === 'brush' && activePath.value) {
        const svg = activePath.value.toSVGString();
        if (svg.length > 5) {
          runOnJS(onPathCompleteJS)(svg);
        } else {
          // If too short to save, clear it immediately
          activePath.value = null;
        }
      }
      prevPoint.value = null;
      erasedIdsInGesture.value = [];
    })
    .onFinalize(() => {
      'worklet';
      showEraser.value = 0;
      prevEraserPoint.value = null;
      // Do NOT clear activePath here unconditionally, or it will flicker before onPathCompleteJS runs
      prevPoint.value = null;
      erasedIdsInGesture.value = [];
    });

  const activePathDerived = useDerivedValue(() => {
    return activePath.value || Skia.Path.Make();
  });

  const eraserRadius = useDerivedValue(() => {
    const scale = canvasScale ? canvasScale.value : 1;
    return 20 / scale; // Larger visual indicator too
  });

  if (width <= 0 || height <= 0) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 25 }]} pointerEvents="box-none">
      <GestureDetector gesture={drawGesture}>
        <Animated.View style={{ width, height }} pointerEvents={interactive ? "auto" : "none"}>
          <Canvas style={{ width, height }}>
            {/* Store Drawings */}
            {existingDrawings.map((ann) => {
              if (!ann.pathData || typeof ann.pathData !== 'string') return null;
              const path = Skia.Path.MakeFromSVGString(ann.pathData);
              if (!path) return null;
              return (
                <SkiaPath
                  key={ann.id}
                  path={path}
                  color={ann.strokeColor || '#000000'}
                  style="stroke"
                  strokeWidth={ann.strokeWidth || 3}
                  strokeCap="round"
                  strokeJoin="round"
                />
              );
            })}

            {/* Local Unsaved Paths */}
            {localPaths.map((p, i) => {
              const path = Skia.Path.MakeFromSVGString(p.path);
              if (!path) return null;
              return (
                <SkiaPath
                  key={`local-${i}`}
                  path={path}
                  color={p.color}
                  style="stroke"
                  strokeWidth={p.width}
                  strokeCap="round"
                  strokeJoin="round"
                />
              );
            })}

            {/* Active Path */}
            <SkiaPath
              path={activePathDerived}
              color={strokeColor}
              style="stroke"
              strokeWidth={strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />

            {/* Visual Cursor */}
            <Group opacity={showEraser}>
              <Circle cx={eraserX} cy={eraserY} r={eraserRadius} color="#FFFFFF" />
              <Circle cx={eraserX} cy={eraserY} r={eraserRadius} color="#000000" style="stroke" strokeWidth={1} />
            </Group>
          </Canvas>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

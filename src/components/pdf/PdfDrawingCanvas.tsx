import type { Annotation } from '@/lib/pdfEditor/usePdfEditorStore';
import { shapePath, shapeAnnotationPath, shapeRotationMatrix, snapLineEnd, type ShapeDraft, type EditorTool } from '../../lib/pdfEditor/drawingTools';
import { Canvas, Circle, Group, Skia, Path as SkiaPath } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { runOnJS, useDerivedValue, useSharedValue, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';

interface PdfDrawingCanvasProps {
  width: number;
  height: number;
  strokeColor: string;
  strokeWidth: number;
  existingDrawings: Annotation[];
  onPathComplete: (pathData: string, shape?: ShapeDraft) => void;
  interactive?: boolean;
  activeTool?: EditorTool;
  onErase?: (id: string) => void;
  canvasScale?: SharedValue<number>;
  renderExistingDrawings?: boolean;
  navigationGestures?: GestureType[];
  navigationActive?: SharedValue<boolean>;
}

export function PdfDrawingCanvas({ width, height, strokeColor, strokeWidth, existingDrawings,
  onPathComplete, interactive = true, activeTool = 'brush', onErase, canvasScale,
  renderExistingDrawings = true, navigationGestures = [], navigationActive }: PdfDrawingCanvasProps) {
  const activePath = useSharedValue<ReturnType<typeof Skia.Path.Make> | null>(null);
  const startPoint = useSharedValue<{ x: number; y: number } | null>(null);
  const prevPoint = useSharedValue<{ x: number; y: number } | null>(null);
  const eraserX = useSharedValue(-100);
  const eraserY = useSharedValue(-100);
  const showEraser = useSharedValue(0);
  const erasedIds = useSharedValue<string[]>([]);
  const cancelled = useSharedValue(false);
  const drawings = useSharedValue<{ id: string; path: ReturnType<typeof Skia.Path.Make>; color: string; width: number }[]>([]);

  const parsedDrawings = useMemo(() => existingDrawings.flatMap(annotation => {
    let path = Skia.Path.MakeFromSVGString(annotation.type === 'shape' ? shapeAnnotationPath(annotation) : annotation.pathData);
    if (path && annotation.type === 'shape' && annotation.rotation) {
      path = Skia.PathBuilder.MakeFromPath(path).transform(shapeRotationMatrix(annotation)).detach();
    }
    return path ? [{ id: annotation.id, path, color: annotation.strokeColor || '#000000', width: annotation.strokeWidth || 3 }] : [];
  }), [existingDrawings]);

  useEffect(() => {
    drawings.set(parsedDrawings);
    // The committed path is now painted by the annotations layer.
    activePath.set(null);
  }, [parsedDrawings, drawings, activePath]);

  useEffect(() => { activePath.set(null); }, [activeTool, activePath]);

  const eraserRadius = useDerivedValue(() => 20 / (canvasScale?.value || 1));
  const hitPaths = useDerivedValue(() => activeTool === 'eraser' ? drawings.value.flatMap(item => {
    const hitPath = Skia.Path.Stroke(item.path, { width: item.width + eraserRadius.value * 2, cap: 1, join: 1 });
    return hitPath ? [{ id: item.id, hitPath }] : [];
  }) : [], [activeTool]);

  const eraseJS = useCallback((id: string) => {
    onErase?.(id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [onErase]);

  const eraseAtPoint = (x: number, y: number) => {
    'worklet';
    for (const item of hitPaths.value) {
      if (!erasedIds.value.includes(item.id) && item.hitPath.contains(x, y)) {
        erasedIds.set([...erasedIds.value, item.id]);
      }
    }
  };

  const cancelDrawing = () => {
    'worklet';
    cancelled.set(true);
    activePath.set(null);
    startPoint.set(null);
    prevPoint.set(null);
    showEraser.set(0);
    erasedIds.set([]);
  };

  useAnimatedReaction(() => navigationActive?.value || false, navigating => {
    if (navigating) cancelDrawing();
  });

  const drawGesture = Gesture.Pan().minDistance(0).maxPointers(1)
    .simultaneousWithExternalGesture(...navigationGestures)
    .onBegin(() => {
      'worklet';
      cancelled.set(navigationActive?.value || false);
    })
    .onTouchesDown((event, manager) => {
      'worklet';
      if (event.numberOfTouches > 1) {
        cancelDrawing();
        manager.fail();
      }
    })
    .onStart(e => {
      'worklet';
      if (navigationActive?.value || cancelled.value || e.numberOfPointers > 1) { cancelDrawing(); return; }
      startPoint.set({ x: e.x, y: e.y });
      prevPoint.set(startPoint.value);
      if (activeTool === 'eraser') {
        eraserX.set(e.x);
        eraserY.set(e.y);
        showEraser.set(1);
        erasedIds.set([]);
        eraseAtPoint(e.x, e.y);
      } else {
        activePath.set(Skia.PathBuilder.Make().moveTo(e.x, e.y).detach());
      }
    })
    .onUpdate(e => {
      'worklet';
      if (navigationActive?.value || e.numberOfPointers > 1) { cancelDrawing(); return; }
      if (cancelled.value) return;
      const previous = prevPoint.value;
      if (!previous || !startPoint.value) return;
      if (activeTool === 'eraser') {
        eraserX.set(e.x);
        eraserY.set(e.y);
        const dx = e.x - previous.x;
        const dy = e.y - previous.y;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (5 / (canvasScale?.value || 1))));
        for (let i = 0; i <= steps; i++) eraseAtPoint(previous.x + dx * i / steps, previous.y + dy * i / steps);
      } else if (activeTool === 'brush' && activePath.value) {
        activePath.set(Skia.PathBuilder.MakeFromPath(activePath.value)
          .quadTo(previous.x, previous.y, (previous.x + e.x) / 2, (previous.y + e.y) / 2).detach());
      } else if (activeTool === 'circle' || activeTool === 'rectangle' || activeTool === 'line') {
        const end = activeTool === 'line' ? snapLineEnd(startPoint.value, { x: e.x, y: e.y }) : { x: e.x, y: e.y };
        activePath.set(Skia.Path.MakeFromSVGString(shapePath(activeTool, startPoint.value, end)));
      }
      prevPoint.set({ x: e.x, y: e.y });
    })
    .onEnd((e, success) => {
      'worklet';
      // A cancelled pan can still emit onEnd when the second finger starts zooming.
      if (success === false || navigationActive?.value || cancelled.value || e.numberOfPointers > 1) { cancelDrawing(); return; }
      if (activeTool === 'eraser') {
        eraseAtPoint(e.x, e.y);
        // Commit only a completed single-finger gesture; zoom must not erase data.
        for (const id of erasedIds.value) runOnJS(eraseJS)(id);
      } else if (activeTool === 'brush' && activePath.value) {
        const path = Skia.PathBuilder.MakeFromPath(activePath.value).lineTo(e.x + 0.001, e.y).detach();
        activePath.set(path);
        runOnJS(onPathComplete)(path.toSVGString());
      } else if (startPoint.value && (activeTool === 'circle' || activeTool === 'rectangle' || activeTool === 'line')) {
        const end = activeTool === 'line' ? snapLineEnd(startPoint.value, { x: e.x, y: e.y }) : { x: e.x, y: e.y };
        const distance = Math.hypot(end.x - startPoint.value.x, end.y - startPoint.value.y);
        const svg = shapePath(activeTool, startPoint.value, end);
        if (distance > 1 && svg) runOnJS(onPathComplete)(svg, { kind: activeTool, start: startPoint.value, end });
        else activePath.set(null);
      }
    })
    .onFinalize((_event, success) => {
      'worklet';
      showEraser.set(0);
      startPoint.set(null);
      prevPoint.set(null);
      erasedIds.set([]);
      if (!success) activePath.set(null);
    });

  const displayedPath = useDerivedValue(() => activePath.value || Skia.Path.Make());
  if (width <= 0 || height <= 0) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 25 }]} pointerEvents="box-none">
      <GestureDetector gesture={drawGesture}>
        <Animated.View style={{ width, height }} pointerEvents={interactive ? 'auto' : 'none'}>
          <Canvas style={{ width, height }}>
            {renderExistingDrawings && parsedDrawings.map(item => (
              <SkiaPath key={item.id} path={item.path} color={item.color} style="stroke" strokeWidth={item.width} strokeCap="round" strokeJoin="round" />
            ))}
            <SkiaPath path={displayedPath} color={strokeColor} style="stroke" strokeWidth={strokeWidth} strokeCap="round" strokeJoin="round" />
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

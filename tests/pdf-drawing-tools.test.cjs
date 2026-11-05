const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { hookRuntime } = require('./hook-runtime.cjs');
const { shapePath, shapeAnnotationPath, snapRightAngle, snapLineEnd, snapObjectRotation, shapeBounds } = createSourceLoader()('src/lib/pdfEditor/drawingTools.ts');
const kit = require('canvaskit-wasm/bin/full/canvaskit.js')({
  wasmBinary: fs.readFileSync(require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm')),
}).then(CanvasKit => {
  const root = path.resolve('node_modules/@shopify/react-native-skia/lib/commonjs/skia/web');
  return {
    Path: new (require(`${root}/JsiSkPathFactory.js`).JsiSkPathFactory)(CanvasKit),
    PathBuilder: new (require(`${root}/JsiSkPathBuilderFactory.js`).JsiSkPathBuilderFactory)(CanvasKit),
  };
});

async function canvas(tool, annotations, callbacks, scale = 1) {
  const runtime = hookRuntime();
  const Skia = await kit;
  let gesture;
  const react = { ...runtime.react,
    useCallback: fn => fn,
    useMemo: (fn, dependencies) => {
      const ref = runtime.react.useRef();
      if (!ref.current || dependencies.some((value, index) => value !== ref.current.dependencies[index])) ref.current = { value: fn(), dependencies };
      return ref.current.value;
    },
  };
  const { PdfDrawingCanvas } = createSourceLoader({
    react,
    'react-native': { View: 'View', StyleSheet: { absoluteFill: {} } },
    '@shopify/react-native-skia': { Skia, Canvas: 'Canvas', Circle: 'Circle', Group: 'Group', Path: 'Path' },
    'expo-haptics': { impactAsync: () => {}, ImpactFeedbackStyle: { Light: 1 } },
    'react-native-reanimated': { View: 'AnimatedView', runOnJS: fn => fn,
      useSharedValue: value => runtime.react.useRef({ value, set(next) { this.value = next; } }).current,
      useDerivedValue: fn => ({ get value() { return fn(); } }),
    },
    'react-native-gesture-handler': { GestureDetector: 'GestureDetector', Gesture: { Pan: () => {
      const callbacks = {};
      const chain = new Proxy({}, { get: (_target, key) => (...values) => { callbacks[key] = values.length === 1 ? values[0] : values; return chain; } });
      gesture = callbacks;
      return chain;
    } } },
  })('src/components/pdf/PdfDrawingCanvas.tsx');
  runtime.flush(() => PdfDrawingCanvas({ width: 300, height: 400, strokeColor: '#cc3300', strokeWidth: 7,
    existingDrawings: annotations, activeTool: tool, canvasScale: { value: scale }, ...callbacks }));
  return gesture;
}

test('brush eraser hits actual strokes on tap and removes them from exportable state with undo support', async () => {
  const { usePdfEditorStore: store } = createSourceLoader()('src/lib/pdfEditor/usePdfEditorStore.ts');
  const id = store.getState().addDrawing(0, 'M 10 50 L 250 50', '#cc3300', 7);
  const erased = [];
  const gesture = await canvas('eraser', store.getState().annotations, {
    onPathComplete: () => assert.fail('eraser must not paint a white stroke'),
    onErase: id => { erased.push(id); store.getState().deleteAnnotation(id); },
  });
  gesture.onStart({ x: 100, y: 50 });
  gesture.onUpdate({ x: 110, y: 50 });
  gesture.onEnd({ x: 110, y: 50 });
  gesture.onFinalize({}, true);
  assert.deepEqual(erased, [id]);
  assert.equal(store.getState().annotations.length, 0);
  store.getState().undo();
  assert.equal(store.getState().annotations[0].id, id);
  store.getState().redo();
  assert.equal(store.getState().annotations.length, 0);
});

test('fast eraser motion samples its full path and respects the visible radius at zoom', async () => {
  const annotation = { id: 'stroke', pathData: 'M 100 20 L 100 180', strokeWidth: 2 };
  const erased = [];
  const gesture = await canvas('eraser', [annotation], { onPathComplete: () => {}, onErase: id => erased.push(id) }, 2);
  gesture.onStart({ x: 10, y: 100 });
  assert.equal(erased.length, 0);
  gesture.onUpdate({ x: 200, y: 100 });
  gesture.onEnd({ x: 200, y: 100 });
  assert.deepEqual(erased, ['stroke']);
  const miss = [];
  const second = await canvas('eraser', [annotation], { onPathComplete: () => {}, onErase: id => miss.push(id) }, 2);
  second.onStart({ x: 115, y: 100 });
  second.onEnd({ x: 115, y: 100 });
  assert.equal(miss.length, 0);
});

for (const tool of ['circle', 'rectangle', 'line', 'brush']) {
  test(`${tool} gesture creates a valid path and eraser can remove it`, async () => {
    const paths = [];
    const gesture = await canvas(tool, [], { onPathComplete: value => paths.push(value) });
    gesture.onStart({ x: 20, y: 30 });
    gesture.onUpdate({ x: 180, y: 130 });
    gesture.onEnd({ x: 180, y: 130 });
    assert.equal(paths.length, 1);
    assert.ok((await kit).Path.MakeFromSVGString(paths[0]));
    const erased = [];
    const eraser = await canvas('eraser', [{ id: tool, pathData: paths[0], strokeWidth: 7 }], {
      onPathComplete: () => {}, onErase: id => erased.push(id),
    });
    // Each shape starts at a different point on its outline.
    eraser.onStart(tool === 'circle' ? { x: 120, y: 80 } : { x: 20, y: 30 });
    eraser.onEnd(tool === 'circle' ? { x: 120, y: 80 } : { x: 20, y: 30 });
    assert.deepEqual(erased, [tool]);
  });
}

test('circles and rectangles can be dragged in either direction without changing geometry', async () => {
  const skia = await kit;
  for (const tool of ['circle', 'rectangle']) {
    const forward = skia.Path.MakeFromSVGString(shapePath(tool, { x: 20, y: 30 }, { x: 120, y: 130 }));
    const backward = skia.Path.MakeFromSVGString(shapePath(tool, { x: 120, y: 130 }, { x: 20, y: 30 }));
    assert.deepEqual(forward.getBounds(), backward.getBounds());
  }
});

test('shapes are selected on creation and retain editable position, size, color and thickness through undo', async () => {
  const { usePdfEditorStore: store } = createSourceLoader()('src/lib/pdfEditor/usePdfEditorStore.ts');
  const id = store.getState().addShape(0, { kind: 'rectangle', start: { x: 20, y: 30 }, end: { x: 120, y: 80 } }, '#cc3300', 7);
  assert.equal(store.getState().selectedId, id);
  store.getState().updateAnnotation(id, { x: 150, y: 200, width: 200, height: 100, strokeWidth: 12, strokeColor: '#336699' });
  const shape = store.getState().annotations[0];
  assert.equal(shape.type, 'shape');
  const bounds = (await kit).Path.MakeFromSVGString(shapeAnnotationPath(shape)).getBounds();
  assert.deepEqual({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, { x: 150, y: 200, width: 200, height: 100 });
  const erased = [];
  const gesture = await canvas('eraser', [shape], { onPathComplete: () => {}, onErase: id => erased.push(id) });
  gesture.onStart({ x: 20, y: 30 });
  assert.equal(erased.length, 0);
  gesture.onUpdate({ x: 150, y: 250 });
  gesture.onEnd({ x: 150, y: 250 });
  assert.deepEqual(erased, [id]);
  store.getState().undo();
  assert.equal(store.getState().annotations[0].width, 100);
  assert.equal(store.getState().annotations[0].strokeWidth, 7);
  store.getState().redo();
  assert.equal(store.getState().annotations[0].strokeColor, '#336699');
});

test('eraser follows the actual outline after a shape is rotated', async () => {
  const { usePdfEditorStore: store } = createSourceLoader()('src/lib/pdfEditor/usePdfEditorStore.ts');
  const id = store.getState().addShape(0, { kind: 'line', start: { x: 50, y: 100 }, end: { x: 150, y: 100 } }, '#000000', 2);
  store.getState().updateAnnotation(id, { rotation: 90 });
  const erased = [];
  const gesture = await canvas('eraser', store.getState().annotations, { onPathComplete: () => {}, onErase: id => erased.push(id) });
  gesture.onStart({ x: 100, y: 55 });
  gesture.onEnd({ x: 100, y: 55 });
  assert.deepEqual(erased, [id]);
});

test('right-angle snapping accepts a five degree tolerance in every direction and preserves free angles', () => {
  for (const target of [-360, -270, -180, -90, 0, 90, 180, 270, 360, 720]) {
    for (const offset of [-5, -2, 0, 2, 5]) assert.equal(snapRightAngle(target + offset), target);
    for (const offset of [-6, 6, 20]) assert.equal(snapRightAngle(target + offset), target + offset);
  }
});

test('line endpoint snapping keeps the starting point and projects onto the nearest axis', () => {
  const start = { x: 20, y: 30 };
  for (const [end, expected] of [
    [{ x: 130, y: 37 }, { x: 130, y: 30 }],
    [{ x: -100, y: 34 }, { x: -100, y: 30 }],
    [{ x: 25, y: 160 }, { x: 20, y: 160 }],
    [{ x: 15, y: -100 }, { x: 20, y: -100 }],
    [{ x: 120, y: 130 }, { x: 120, y: 130 }],
  ]) assert.deepEqual(snapLineEnd(start, end), expected);
});

test('line gestures commit the same snapped coordinates used by the preview', async () => {
  const completed = [];
  const gesture = await canvas('line', [], { onPathComplete: (svg, draft) => completed.push({ svg, draft }) });
  gesture.onStart({ x: 20, y: 30 });
  gesture.onUpdate({ x: 130, y: 37 });
  gesture.onEnd({ x: 130, y: 37 });
  assert.equal(completed[0].svg, 'M 20 30 L 130 30');
  assert.deepEqual(completed[0].draft.end, { x: 130, y: 30 });
  assert.equal(shapeAnnotationPath(shapeBounds(completed[0].draft)), completed[0].svg);
});

test('all objects snap in the rotation handle and diagonal lines snap by their visible angle', () => {
  for (const type of ['text', 'image', 'shape']) {
    assert.equal(snapObjectRotation(88, { type, x: 0, y: 0, width: 100, height: 50, shapeKind: 'rectangle' }), 90);
    assert.equal(snapObjectRotation(176, { type, x: 0, y: 0, width: 100, height: 50 }), 180);
  }
  const line = { type: 'shape', ...shapeBounds({ kind: 'line', start: { x: 20, y: 30 }, end: { x: 120, y: 130 } }) };
  assert.equal(snapObjectRotation(43, line), 45);
  assert.equal(snapObjectRotation(-43, line), -45);
  assert.equal(snapObjectRotation(30, line), 30);
});

for (const tool of ['line', 'rectangle', 'circle', 'brush', 'eraser']) {
  test(`${tool} cancels without changes when a second finger starts zooming`, async () => {
    const committed = [], erased = [];
    let failed = 0;
    const navigationGestures = [{ name: 'pinch' }, { name: 'pan' }];
    const gesture = await canvas(tool, [{ id: 'existing', pathData: 'M 10 30 L 200 30', strokeWidth: 0.1 }], {
      onPathComplete: path => committed.push(path), onErase: id => erased.push(id), navigationGestures,
    });
    assert.deepEqual(gesture.simultaneousWithExternalGesture, navigationGestures);
    gesture.onBegin();
    gesture.onStart({ x: 20, y: 30, numberOfPointers: 1 });
    gesture.onUpdate({ x: 100, y: 80, numberOfPointers: 1 });
    gesture.onTouchesDown({ numberOfTouches: 2 }, { fail: () => failed++ });
    // Some platforms still deliver updates/end after the cancelled gesture.
    gesture.onUpdate({ x: 150, y: 130, numberOfPointers: 2 });
    gesture.onUpdate({ x: 180, y: 130, numberOfPointers: 1 });
    gesture.onEnd({ x: 180, y: 130, numberOfPointers: 1 }, true);
    gesture.onFinalize({}, false);
    assert.equal(failed, 1);
    assert.deepEqual(committed, []);
    assert.deepEqual(erased, []);
  });
}

test('unsuccessful single-finger gestures never commit a shape', async () => {
  const committed = [];
  const gesture = await canvas('line', [], { onPathComplete: path => committed.push(path) });
  gesture.onBegin();
  gesture.onStart({ x: 20, y: 30, numberOfPointers: 1 });
  gesture.onUpdate({ x: 100, y: 30, numberOfPointers: 1 });
  gesture.onEnd({ x: 100, y: 30, numberOfPointers: 1 }, false);
  assert.deepEqual(committed, []);
});

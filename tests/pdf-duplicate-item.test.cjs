const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { duplicatePosition } = createSourceLoader()('src/lib/pdfEditor/duplicatePosition.ts');

for (const type of ['text', 'image', 'shape']) {
  test(`duplicating ${type} creates an independent selected copy and supports undo/redo`, () => {
    const { usePdfEditorStore: store } = createSourceLoader()('src/lib/pdfEditor/usePdfEditorStore.ts');
    const state = store.getState();
    const id = type === 'text' ? state.addText(0, 20, 30)
      : type === 'image' ? state.addImage(0, 20, 30, 100, 80, 'file:///picture.jpg', 500, 400)
      : state.addShape(0, { kind: 'line', start: { x: 20, y: 30 }, end: { x: 120, y: 100 } }, '#336699', 0.3);
    state.updateAnnotation(id, { rotation: 90, fontFamily: 'PdfTinos', lineSpacing: 1.7, content: type === 'text' ? 'ação\n____' : store.getState().annotations[0].content,
      cropX: -4, cropY: -2, isCropping: type === 'image' });
    const original = store.getState().annotations[0];
    const historySize = store.getState().past.length;
    const newId = store.getState().duplicateAnnotation(id, { x: 250, y: 30 });
    assert.notEqual(newId, id);
    assert.equal(store.getState().selectedId, newId);
    assert.equal(store.getState().past.length, historySize + 1);
    const copy = store.getState().annotations[1];
    assert.deepEqual(copy, { ...original, id: newId, x: 250, y: 30, isCropping: false });
    assert.notEqual(copy, original);
    if (type === 'shape') assert.notEqual(copy.shapeStart, original.shapeStart);
    assert.equal(store.getState().annotations[0], original);
    store.getState().undo();
    assert.deepEqual(store.getState().annotations, [original]);
    store.getState().redo();
    assert.equal(store.getState().annotations[1].id, newId);
    store.getState().updateAnnotation(newId, { content: 'edited copy', width: 150 });
    assert.equal(store.getState().annotations[0].content, original.content);
    assert.equal(store.getState().annotations[0].width, original.width);
  });
}

test('copy placement prefers the right, then the left, then an offset within page bounds', () => {
  const page = { width: 400, height: 600 };
  assert.deepEqual(duplicatePosition({ x: 20, y: 30, width: 100, height: 80 }, page, 16), { x: 136, y: 30 });
  assert.deepEqual(duplicatePosition({ x: 290, y: 30, width: 100, height: 80 }, page, 16), { x: 174, y: 30 });
  assert.deepEqual(duplicatePosition({ x: 0, y: 500, width: 390, height: 100 }, page, 16), { x: 10, y: 500 });
  const rotated = duplicatePosition({ x: 100, y: 100, width: 100, height: 20, rotation: 90 }, page, 16);
  assert.ok(Math.abs(rotated.x - 136) < 0.00001);
  assert.equal(rotated.y, 100);
});

test('an expired item action cannot create a duplicate or add undo history', () => {
  const { usePdfEditorStore: store } = createSourceLoader()('src/lib/pdfEditor/usePdfEditorStore.ts');
  assert.equal(store.getState().duplicateAnnotation('missing', { x: 20, y: 30 }), null);
  assert.equal(store.getState().past.length, 0);
  assert.equal(store.getState().annotations.length, 0);
});

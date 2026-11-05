const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { hookRuntime } = require('./hook-runtime.cjs');
const nativeLayout = createSourceLoader()('src/lib/pdfEditor/nativeTextLayout.ts');
const typography = createSourceLoader()('src/lib/pdfEditor/textLayout.ts');
const annotation = { id: 'text', type: 'text', content: '____'.repeat(12), width: 200, height: 80, fontSize: 12, x: 20, y: 100, rotation: 0 };
const lines = [
  { text: '_'.repeat(24), x: 0, y: 0, width: 190, height: 15, ascender: 12 },
  { text: '_'.repeat(24), x: 0, y: 15, width: 190, height: 15, ascender: 12 },
];

test('native measurements retain automatic wraps and exclude stale text/font/width snapshots', () => {
  const snapshot = { ...nativeLayout.nativeTextLayoutKey(annotation), lines };
  assert.ok(nativeLayout.matchesNativeTextLayout(annotation, snapshot));
  const measured = nativeLayout.measuredAnnotationText(annotation, snapshot);
  assert.deepEqual(measured.lines.map(line => line.width), [190, 190]);
  assert.deepEqual(measured.lines.map(line => line.baseline), [37, 52]);
  for (const change of [{ width: 199 }, { fontSize: 11 }, { content: 'new' }, { lineSpacing: 2 }, { fontFamily: 'PdfRoboto' }]) {
    assert.equal(nativeLayout.matchesNativeTextLayout({ ...annotation, ...change }, snapshot), false);
  }
  assert.ok(nativeLayout.matchesNativeTextLayout({ ...annotation, height: 120, x: 200, rotation: 90 }, snapshot));
});

test('editing and inactive preview retain the same native input and resizing does not reload font metrics', async () => {
  const runtime = hookRuntime();
  let loads = 0, editing = true, box = annotation;
  const snapshots = [], heights = [];
  const { PdfAnnotationText } = createSourceLoader({
    react: runtime.react,
    'react-native': { Text: 'Text', TextInput: 'TextInput', View: 'View' },
    '@/lib/pdfEditor/annotationFont': { loadAnnotationTypeface: async () => { loads++; } },
    '@/lib/pdfEditor/nativeTextLayout': nativeLayout,
    '@/lib/pdfEditor/textLayout': typography,
  })('src/components/pdf/PdfAnnotationText.tsx');
  runtime.flush(() => PdfAnnotationText({ annotation: box, isEditing: editing,
    onNativeLayout: (id, snapshot) => snapshots.push(snapshot), onContentHeight: height => heights.push(height) }));
  await Promise.resolve();
  runtime.flush();
  const input = () => runtime.result().props.children.props.children[0];
  assert.equal(input().type, 'TextInput');
  assert.equal(input().props.editable, true);
  const measurement = runtime.result().props.children.props.children[1];
  measurement.props.onTextLayout({ nativeEvent: { lines } });
  assert.equal(snapshots[0].lines[0].width, 190);
  assert.deepEqual(heights, [30]);
  editing = false;
  runtime.flush();
  assert.equal(input().type, 'TextInput');
  assert.equal(input().props.editable, false);
  assert.equal(input().key, null);
  assert.equal(runtime.result().props.onLayout, undefined);
  box = { ...annotation, width: 230 };
  runtime.flush();
  assert.equal(loads, 1);
  assert.equal(input().props.style[1].flex, 1);
  assert.equal(input().props.value, annotation.content);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');

const kit = require('canvaskit-wasm/bin/full/canvaskit.js')({
  wasmBinary: fs.readFileSync(require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm')),
}).then(CanvasKit => {
  const { JsiSkApi } = require('../node_modules/@shopify/react-native-skia/lib/commonjs/skia/web/JsiSkia.js');
  const Skia = JsiSkApi(CanvasKit);
  const data = Skia.Data.fromBytes(fs.readFileSync('assets/fonts/Montserrat-SemiBold.ttf'));
  const font = Skia.Font(Skia.Typeface.MakeFreeTypeFaceFromData(data), 13);
  return { CanvasKit, Skia, font };
});

async function fixture() {
  const { CanvasKit, Skia, font } = await kit;
  let loadedFont = null;
  const { MindMapCanvas } = createSourceLoader({
    react: { memo: fn => fn, useMemo: fn => fn() },
    'react-native': { Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 400, height: 800 }) },
    'react-native-reanimated': { useDerivedValue: fn => ({ get value() { return fn(); } }) },
    '@shopify/react-native-skia': { Skia, Canvas: 'Canvas', Group: 'Group', Picture: 'Picture',
      useFont: () => loadedFont },
    '../../../assets/fonts/Montserrat-SemiBold.ttf': 1,
  })('src/lib/mindmap/MindMapCanvas.tsx');
  const value = value => ({ value });
  const resizeState = { resizeNodeId: value(null), resizeLiveW: value(0), resizeLiveH: value(0) };
  let node = { id: 'root', title: 'Ideias para amanhã', x: 0, y: 0, width: 220, height: 100, depth: 0 };
  let editingId = null;
  function findText(element) {
    if (!element) return null;
    if (Array.isArray(element)) return element.map(findText).find(Boolean);
    if (typeof element.type === 'function') {
      if (element.type.name === 'NodeText') return element.type(element.props);
      if (['BackgroundLayer', 'EdgeLayer', 'NodeShell'].includes(element.type.name)) return null;
      return findText(element.type(element.props));
    }
    return findText(element.props?.children);
  }
  function picture() {
    const tree = MindMapCanvas({ nodes: [node], selectedId: null, editingId,
      primaryColor: '#6366f1', isDark: true, canvasBgColor: null, bgPattern: 'none',
      childDirsMap: new Map(), hiddenNodes: new Set(), resizeState,
      dragState: { dragNodeId: value(null) }, translateX: value(0), translateY: value(0), scale: value(1) });
    return findText(tree)?.props.children[0].props.picture.value;
  }
  function pixels(picture) {
    const surface = CanvasKit.MakeSurface(500, 600);
    surface.getCanvas().clear(CanvasKit.TRANSPARENT);
    surface.getCanvas().drawPicture(picture.ref);
    const image = surface.makeImageSnapshot();
    const pixels = image.readPixels(0, 0, { width: 500, height: 600,
      colorType: CanvasKit.ColorType.RGBA_8888, alphaType: CanvasKit.AlphaType.Unpremul,
      colorSpace: CanvasKit.ColorSpace.SRGB });
    const visible = [];
    for (let y = 0; y < 600; y++) for (let x = 0; x < 500; x++) {
      if (pixels[(y * 500 + x) * 4 + 3]) visible.push({ x, y });
    }
    image.delete(); surface.delete(); picture.dispose();
    return visible;
  }
  return { picture, pixels, resizeState, loadFont: () => { loadedFont = font; },
    edit: id => { editingId = id; }, update: changes => { node = { ...node, ...changes }; } };
}

test('saved titles render after the font loads and return after leaving inline editing', async () => {
  const f = await fixture();
  assert.equal(f.picture(), undefined);
  f.loadFont();
  const before = f.pixels(f.picture());
  assert.ok(before.length > 100, 'title must draw visible glyphs');
  f.edit('root');
  assert.equal(f.pixels(f.picture()).length, 0);
  f.edit(null);
  assert.deepEqual(f.pixels(f.picture()), before);
  f.update({ title: 'Título alterado' });
  assert.notDeepEqual(f.pixels(f.picture()), before);
});

test('text reflows during live resize and honors left, center and right alignment', async () => {
  const f = await fixture();
  f.loadFont();
  const center = f.pixels(f.picture());
  f.update({ textAlign: 'left' });
  const left = f.pixels(f.picture());
  f.update({ textAlign: 'right' });
  const right = f.pixels(f.picture());
  assert.ok(Math.min(...left.map(p => p.x)) < Math.min(...center.map(p => p.x)));
  assert.ok(Math.min(...right.map(p => p.x)) > Math.min(...center.map(p => p.x)));
  f.resizeState.resizeNodeId.value = 'root';
  f.resizeState.resizeLiveW.value = 120;
  f.resizeState.resizeLiveH.value = 160;
  const resized = f.pixels(f.picture());
  assert.ok(resized.every(p => p.x < 120 && p.y < 160));
  assert.ok(Math.max(...resized.map(p => p.y)) - Math.min(...resized.map(p => p.y)) > 20);
});

test('all explicit lines render without a fixed fifteen-line limit', async () => {
  const f = await fixture();
  f.loadFont();
  f.update({ title: Array.from({ length: 18 }, () => 'Texto').join('\n'), height: 440 });
  const pixels = f.pixels(f.picture());
  const rows = new Set(pixels.map(p => p.y));
  let bands = 0;
  for (let y = 0; y < 600; y++) if (rows.has(y) && !rows.has(y - 1)) bands++;
  assert.equal(bands, 18);
});

test('inline editing keeps native wrapping at the same logical width and font size at every zoom', () => {
  const { InlineNodeEditor } = createSourceLoader({
    react: { memo: fn => fn },
    'react-native': { Platform: { OS: 'android' }, TextInput: 'TextInput' },
    'react-native-reanimated': { __esModule: true, default: { View: 'AnimatedView' }, useAnimatedStyle: fn => fn() },
  })('src/lib/mindmap/InlineNodeEditor.tsx');
  const layout = createSourceLoader()('src/lib/mindmap/textLayout.ts');
  for (const zoom of [0.5, 1, 1.8, 3.7]) {
    const node = { id: 'root', title: 'Modelagem 3D no Ensino Fundamental II',
      x: 50, y: 75, width: 160, height: 100, depth: 0 };
    const element = InlineNodeEditor({ node, text: node.title, isDark: true,
      onSave() {}, onTextChange() {}, transform: {
        scale: { value: zoom }, translateX: { value: -20 }, translateY: { value: 30 },
      } });
    const style = element.props.style;
    const input = element.props.children.props;
    const textStyle = Object.assign({}, ...input.style);
    assert.equal(style.width, node.width);
    assert.equal(style.height, node.height);
    assert.equal(style.transformOrigin, 'left top');
    assert.equal(style.transform[0].translateX, -20 + node.x * zoom);
    assert.equal(style.transform[1].translateY, 30 + node.y * zoom);
    assert.equal(style.transform[2].scale, zoom);
    assert.equal(textStyle.fontSize, layout.NODE_TEXT_SIZE);
    assert.equal(textStyle.lineHeight, layout.NODE_TEXT_LINE_HEIGHT);
    assert.equal(textStyle.paddingHorizontal, layout.NODE_TEXT_PADDING);
    assert.equal(input.textBreakStrategy, 'simple');
    assert.equal(input.allowFontScaling, false);
    assert.equal(input.scrollEnabled, false);
  }
});

test('wrapping counts advance widths including spaces and preserves explicit newlines', async () => {
  const { font } = await kit;
  const { measureNodeText, wrapNodeText } = createSourceLoader()('src/lib/mindmap/textLayout.ts');
  assert.ok(measureNodeText('Texto ', font) > measureNodeText('Texto', font));
  const lines = wrapNodeText('Modelagem 3D no Ensino Fundamental II', 128, font);
  assert.equal(lines.join(' '), 'Modelagem 3D no Ensino Fundamental II');
  for (let i = 0; i < lines.length; i++) {
    assert.ok(measureNodeText(lines[i], font) <= 128);
    if (i + 1 < lines.length) {
      assert.ok(measureNodeText(lines[i] + ' ' + lines[i + 1].split(' ')[0], font) > 128);
    }
  }
  assert.deepEqual(Array.from(wrapNodeText('Primeiro\n\nÚltimo', 128, font)), ['Primeiro', '', 'Último']);
});

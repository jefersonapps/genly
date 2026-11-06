const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const drawingTools = createSourceLoader()('src/lib/pdfEditor/drawingTools.ts');
const { PdfShapeAnnotation } = createSourceLoader({
  react: { useState: initial => [initial, () => {}] },
  'react-native': { View: 'View', PixelRatio: { get: () => 2.8125 } },
  'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
  '@/lib/pdfEditor/drawingTools': drawingTools,
})('src/components/pdf/PdfShapeAnnotation.tsx');

test('shape viewports contain the full stroke around every edge without shifting its position', () => {
  for (const shapeKind of ['rectangle', 'circle', 'line']) for (const strokeWidth of [0.1, 4, 20]) {
    const element = PdfShapeAnnotation({ annotation: { shapeKind, x: 100, y: 200, width: 120, height: 60, strokeColor: '#000000', strokeWidth } });
    const viewport = element.props.children;
    const svg = viewport.props.children;
    const [x, y, width, height] = svg.props.viewBox.split(' ').map(Number);
    assert.ok(x <= -strokeWidth / 2);
    assert.ok(y <= -strokeWidth / 2);
    assert.ok(x + width >= 120 + strokeWidth / 2);
    assert.ok(y + height >= 60 + strokeWidth / 2);
    assert.equal(viewport.props.style.left, x);
    assert.equal(viewport.props.style.top, y);
    assert.equal(viewport.props.style.width, width);
    assert.equal(viewport.props.style.height, height);
    assert.equal(svg.props.width, '100%');
    assert.equal(svg.props.height, '100%');
    assert.ok(Math.abs(x * 2.8125 - Math.round(x * 2.8125)) < 0.00001);
  }
});

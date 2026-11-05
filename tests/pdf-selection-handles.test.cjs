const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');

const { PdfSelectionHandle } = createSourceLoader({
  'react-native-gesture-handler': { GestureDetector: 'GestureDetector' },
  'react-native-reanimated': { View: 'AnimatedView', useAnimatedStyle: snapshot => ({ snapshot }) },
})('src/components/pdf/PdfSelectionHandle.tsx');

test('grips stay centered on all anchors at fractional zoom levels and during live resizing', () => {
  const canvasScale = { value: 1 };
  const boxWidth = { value: 200 }, boxHeight = { value: 40 };
  for (const horizontal of ['left', 'center', 'right']) {
    for (const vertical of ['top', 'center', 'bottom']) {
      if (horizontal === 'center' && vertical === 'center') continue;
      for (const kind of ['corner', 'edge', 'crop']) {
        const element = PdfSelectionHandle({ gesture: {}, canvasScale, boxWidth, boxHeight, horizontal, vertical, kind, color: '#7650cc' });
        const target = element.props.children;
        const glyph = target.props.children.props.style;
        for (const zoom of [0.5, 1, 1.375, 3.2, 5]) {
          canvasScale.value = zoom;
          for (const [width, height] of [[200, 40], [123.456, 20.125], [10.25, 8.75]]) {
            boxWidth.value = width;
            boxHeight.value = height;
            const style = Object.assign({}, ...target.props.style.map(value => value.snapshot ? value.snapshot() : value));
            // Fixed native layout sizes avoid accumulating layout rounding errors.
            assert.equal(style.width, 36);
            assert.equal(style.height, 36);
            const [translationX, translationY, inverseZoom] = style.transform;
            const x = horizontal === 'left' ? 0 : horizontal === 'right' ? width : width / 2;
            const y = vertical === 'top' ? 0 : vertical === 'bottom' ? height : height / 2;
            assert.ok(Math.abs((style.width / 2 + translationX.translateX - x) * zoom) < 1e-9);
            assert.ok(Math.abs((style.height / 2 + translationY.translateY - y) * zoom) < 1e-9);
            assert.ok(Math.abs(glyph.width * inverseZoom.scale * zoom - (kind === 'corner' ? 16 : 12)) < 1e-9);
            assert.ok(Math.abs(style.width * inverseZoom.scale * zoom - 36) < 1e-9);
          }
        }
      }
    }
  }
});

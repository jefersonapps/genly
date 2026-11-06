const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');

function fixture(initial = { scale: 1, x: 0, y: 0 }) {
  const callbacks = {};
  const builder = name => {
    callbacks[name] = {};
    const chain = new Proxy({}, { get: (_target, key) => value => { callbacks[name][key] = value; return chain; } });
    return chain;
  };
  const { createPageNavigation, INITIAL_PAGE_NAVIGATION } = createSourceLoader({
    'react-native-gesture-handler': { Gesture: { Pan: () => builder('pan'), Pinch: () => builder('pinch') } },
  })('src/lib/pdfEditor/pageNavigation.ts');
  const shared = value => ({ value, set(next) { this.value = next; } });
  const scale = shared(initial.scale), translateX = shared(initial.x), translateY = shared(initial.y);
  const navigationActive = shared(false), state = shared({ ...INITIAL_PAGE_NAVIGATION });
  createPageNavigation({ scale, translateX, translateY, navigationActive, state });
  return { ...callbacks, scale, translateX, translateY, navigationActive, state };
}

test('pinching keeps the document point under the fingers fixed across off-center focus points', () => {
  for (const initial of [{ scale: 1, x: 0, y: 0 }, { scale: 2.3, x: -160, y: 75 }, { scale: 0.75, x: 60, y: -40 }]) {
    for (const focus of [{ focalX: 15, focalY: 50 }, { focalX: 340, focalY: 600 }, { focalX: 180, focalY: 310 }]) {
      const f = fixture(initial);
      const documentX = (focus.focalX - initial.x) / initial.scale;
      const documentY = (focus.focalY - initial.y) / initial.scale;
      f.pinch.onStart(focus);
      for (const factor of [1.1, 1.7, 0.6, 10, 0.01]) {
        f.pinch.onUpdate({ ...focus, scale: factor });
        assert.ok(Math.abs(documentX * f.scale.value + f.translateX.value - focus.focalX) < 1e-9);
        assert.ok(Math.abs(documentY * f.scale.value + f.translateY.value - focus.focalY) < 1e-9);
        assert.ok(f.scale.value >= 0.5 && f.scale.value <= 5);
      }
    }
  }
});

test('moving pinch midpoint pans once even when the simultaneous pan also updates', () => {
  const f = fixture();
  f.pan.onStart({ translationX: 0, translationY: 0 });
  f.pinch.onStart({ focalX: 100, focalY: 150 });
  f.pinch.onUpdate({ focalX: 125, focalY: 170, scale: 2 });
  assert.equal(f.translateX.value, -75);
  assert.equal(f.translateY.value, -130);
  f.pan.onUpdate({ translationX: 25, translationY: 20 });
  assert.equal(f.translateX.value, -75);
  assert.equal(f.translateY.value, -130);
  f.pinch.onFinalize();
  f.pan.onUpdate({ translationX: 30, translationY: 27, numberOfPointers: 2 });
  assert.equal(f.translateX.value, -75);
  assert.equal(f.translateY.value, -130);
});

test('two-finger pan is incremental and a later pinch starts at the current position without a jump', () => {
  const f = fixture({ scale: 2, x: -50, y: -100 });
  assert.equal(f.pan.minPointers, 2);
  assert.equal(f.pan.averageTouches, true);
  f.pan.onStart({ translationX: 15, translationY: 10 });
  f.pan.onUpdate({ translationX: 35, translationY: 40, numberOfPointers: 2 });
  assert.equal(f.translateX.value, -30);
  assert.equal(f.translateY.value, -70);
  f.pinch.onStart({ focalX: 200, focalY: 300 });
  f.pinch.onUpdate({ focalX: 200, focalY: 300, scale: 1 });
  assert.equal(f.translateX.value, -30);
  assert.equal(f.translateY.value, -70);
});

test('lifting fingers preserves the last pinch position regardless of final callback order', () => {
  for (const order of ['touch-first', 'finalize-first']) {
    const f = fixture();
    f.pan.onStart({ translationX: 0, translationY: 0 });
    f.pinch.onStart({ focalX: 100, focalY: 150 });
    f.pinch.onUpdate({ focalX: 125, focalY: 170, scale: 2, numberOfPointers: 2 });
    f.pan.onUpdate({ translationX: 25, translationY: 20, numberOfPointers: 2 });
    if (order === 'touch-first') {
      f.pinch.onTouchesUp({ numberOfTouches: 1 });
      // Android may still deliver a focal-point update during pointer removal.
      f.pinch.onUpdate({ focalX: 180, focalY: 200, scale: 2.01, numberOfPointers: 2 });
    }
    f.pinch.onFinalize();
    f.pan.onUpdate({ translationX: 40, translationY: 30, numberOfPointers: 1 });
    f.pan.onUpdate({ translationX: 42, translationY: 31, numberOfPointers: 2 });
    f.pan.onTouchesUp({ numberOfTouches: 0 });
    assert.equal(f.translateX.value, -75);
    assert.equal(f.translateY.value, -130);
    assert.equal(f.scale.value, 2);
    assert.equal(f.navigationActive.value, false);

    // A fresh pan still works after the pinch is released.
    f.pan.onStart({ translationX: 0, translationY: 0 });
    f.pan.onUpdate({ translationX: 5, translationY: 7, numberOfPointers: 2 });
    assert.equal(f.translateX.value, -70);
    assert.equal(f.translateY.value, -123);
  }
});

test('single-pointer pinch updates never change the last valid zoom', () => {
  const f = fixture();
  f.pinch.onStart({ focalX: 100, focalY: 150 });
  f.pinch.onUpdate({ focalX: 110, focalY: 160, scale: 1.5, numberOfPointers: 2 });
  f.pinch.onUpdate({ focalX: 0, focalY: 0, scale: 1.6, numberOfPointers: 1 });
  assert.equal(f.scale.value, 1.5);
  assert.equal(f.translateX.value, -40);
  assert.equal(f.translateY.value, -65);
});

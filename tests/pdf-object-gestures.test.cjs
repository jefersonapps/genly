const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');

function fixture() {
  let events;
  const { singlePointerPan } = createSourceLoader({
    'react-native-gesture-handler': { Gesture: { Pan: () => {
      events = {};
      const builder = new Proxy({}, { get: (_target, key) => (...values) => {
        events[key] = values.length === 1 ? values[0] : values;
        return builder;
      } });
      return builder;
    } } },
  })('src/lib/pdfEditor/singlePointerPan.ts');
  const state = { value: {}, set(value) { this.value = value; } };
  return { state, create(options) { singlePointerPan({ state, ...options }); return events; } };
}

for (const operation of ['drag', 'resize', 'rotation']) {
  test(`${operation} commits with one finger and yields to pan when a second finger arrives`, () => {
    const f = fixture();
    let position = 0, commits = 0, cancellations = 0;
    const navigationGestures = [{ type: 'pan' }, { type: 'pinch' }];
    const events = f.create({ id: operation, navigationGestures,
      onStart: () => {}, onUpdate: event => { position = event.translationX; },
      onEnd: () => commits++, onCancel: () => { position = 0; cancellations++; },
    });
    assert.equal(events.maxPointers, 1);
    assert.deepEqual(events.simultaneousWithExternalGesture, navigationGestures);
    events.onBegin();
    events.onStart({ numberOfPointers: 1 });
    events.onUpdate({ numberOfPointers: 1, translationX: 20 });
    assert.equal(position, 20);
    events.onEnd({ numberOfPointers: 1 }, true);
    events.onFinalize({}, true);
    assert.equal(commits, 1);
    assert.equal(cancellations, 0);

    position = 0;
    events.onBegin();
    events.onStart({ numberOfPointers: 1 });
    events.onUpdate({ numberOfPointers: 1, translationX: 12 });
    let failed = false;
    events.onTouchesDown({ numberOfTouches: 2 }, { fail: () => { failed = true; } });
    assert.equal(failed, true);
    assert.equal(position, 0);
    events.onUpdate({ numberOfPointers: 2, translationX: 80 });
    events.onUpdate({ numberOfPointers: 1, translationX: 90 });
    events.onEnd({ numberOfPointers: 1 }, true);
    events.onFinalize({}, false);
    assert.equal(position, 0);
    assert.equal(commits, 1);
    assert.equal(cancellations, 1);

    // A fresh single-finger gesture must still work after cancelling a pan.
    events.onBegin();
    events.onStart({ numberOfPointers: 1 });
    events.onUpdate({ numberOfPointers: 1, translationX: 30 });
    events.onEnd({ numberOfPointers: 1 }, true);
    assert.equal(position, 30);
    assert.equal(commits, 2);
  });
}

test('two-finger starts and unsuccessful endings never commit object edits', () => {
  const f = fixture();
  let started = 0, committed = 0, cancelled = 0;
  const events = f.create({ id: 'drag', navigationGestures: [], onStart: () => started++, onUpdate: () => {},
    onEnd: () => committed++, onCancel: () => cancelled++ });
  events.onBegin();
  events.onStart({ numberOfPointers: 2 });
  events.onEnd({ numberOfPointers: 2 }, true);
  assert.equal(started, 0);
  assert.equal(committed, 0);
  events.onBegin();
  events.onStart({ numberOfPointers: 1 });
  events.onEnd({ numberOfPointers: 1 }, false);
  assert.equal(cancelled, 1);
  assert.equal(committed, 0);
});

test('a competing resize gesture that never activated cannot roll back an active object drag', () => {
  const f = fixture();
  let rollback = 0;
  const options = { navigationGestures: [], onStart: () => {}, onUpdate: () => {}, onEnd: () => {}, onCancel: () => rollback++ };
  const drag = f.create({ ...options, id: 'drag' });
  const resize = f.create({ ...options, id: 'resize' });
  drag.onBegin();
  resize.onBegin();
  drag.onStart({ numberOfPointers: 1 });
  resize.onFinalize({}, false);
  assert.equal(rollback, 0);
  assert.equal(f.state.value.drag.active, true);
});

test('page navigation cancels object drag even when the second finger is outside the object', () => {
  const f = fixture();
  const navigationActive = { value: false };
  let position = 0, commits = 0;
  const events = f.create({ id: 'drag', navigationGestures: [], navigationActive,
    onStart: () => {}, onUpdate: event => { position = event.translationX; },
    onEnd: () => commits++, onCancel: () => { position = 0; } });
  events.onBegin();
  events.onStart({ numberOfPointers: 1 });
  events.onUpdate({ numberOfPointers: 1, translationX: 10 });
  navigationActive.value = true;
  // This recognizer sees only the finger inside its own bounds.
  events.onUpdate({ numberOfPointers: 1, translationX: 100 });
  assert.equal(position, 0);
  navigationActive.value = false;
  events.onUpdate({ numberOfPointers: 1, translationX: 200 });
  events.onEnd({ numberOfPointers: 1 }, true);
  assert.equal(position, 0);
  assert.equal(commits, 0);
});

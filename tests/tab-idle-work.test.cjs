const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');

function idleEnvironment(run) {
  const previousRequest = global.requestIdleCallback;
  const previousCancel = global.cancelIdleCallback;
  const queued = [];
  const cancelled = [];
  global.requestIdleCallback = callback => { queued.push(callback); return queued.length; };
  global.cancelIdleCallback = id => { cancelled.push(id); };
  try { run({ queued, cancelled }); }
  finally {
    if (previousRequest) global.requestIdleCallback = previousRequest;
    else delete global.requestIdleCallback;
    if (previousCancel) global.cancelIdleCallback = previousCancel;
    else delete global.cancelIdleCallback;
  }
}

test('data refresh waits for idle and cancellation blocks work already queued for execution', () => idleEnvironment(({ queued, cancelled }) => {
  const { scheduleIdleTask } = createSourceLoader()('src/utils/idle.ts');
  let calls = 0;
  const cancel = scheduleIdleTask(() => calls++);
  assert.equal(calls, 0);
  cancel();
  queued[0]();
  assert.equal(calls, 0);
  assert.deepEqual(cancelled, [1]);
  scheduleIdleTask(() => calls++);
  queued[1]();
  assert.equal(calls, 1);
}));

test('rapid tab switches cancel pending refreshes and run cleanup after a completed refresh', () => idleEnvironment(({ queued }) => {
  const { scheduleIdleTask } = createSourceLoader()('src/utils/idle.ts');
  let focus;
  let refreshes = 0;
  let cleanups = 0;
  const load = createSourceLoader({
    '@/utils/idle': { scheduleIdleTask },
    'expo-router': { useFocusEffect: effect => { focus = effect; } },
    react: { useCallback: callback => callback },
  });
  load('src/hooks/useDeferredFocusEffect.ts').useDeferredFocusEffect(() => {
    refreshes++;
    return () => cleanups++;
  });
  const blurBeforeIdle = focus();
  blurBeforeIdle();
  queued[0]();
  assert.equal(refreshes, 0);
  const blurAfterIdle = focus();
  queued[1]();
  assert.equal(refreshes, 1);
  blurAfterIdle();
  assert.equal(cleanups, 1);
}));

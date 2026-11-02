const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');

async function fixture(run) {
  let cleanup, listener, subscriber, timer;
  let refreshes = 0, intervals = 0, clears = 0;
  const originalSet = global.setInterval, originalClear = global.clearInterval;
  global.setInterval = callback => { timer = callback; intervals++; return intervals; };
  global.clearInterval = () => { timer = null; clears++; };
  const state = { isDownloading: true, refreshDownload: async () => { refreshes++; } };
  const appState = { currentState: 'active', addEventListener: (_name, callback) => {
    listener = callback; return { remove: () => { listener = null; } };
  } };
  const store = { getState: () => state, subscribe: callback => {
    subscriber = callback; return () => { subscriber = null; };
  } };
  try {
    createSourceLoader({
      react: { useEffect: callback => { cleanup = callback(); } },
      'react-native': { Platform: { OS: 'android' }, AppState: appState },
      '@/store/useAppUpdateStore': { useAppUpdateStore: store },
    })('src/hooks/useUpdateDownloadMonitor.ts').useUpdateDownloadMonitor();
    await Promise.resolve();
    await run({
      state, refreshes: () => refreshes, intervals: () => intervals, clears: () => clears,
      background: () => { appState.currentState = 'background'; listener('background'); },
      foreground: async () => { appState.currentState = 'active'; listener('active'); await Promise.resolve(); },
      notify: () => subscriber(), tick: () => timer?.(), stop: () => cleanup(),
      subscribed: () => Boolean(listener || subscriber),
    });
  } finally { cleanup?.(); global.setInterval = originalSet; global.clearInterval = originalClear; }
}

test('monitor recovers on startup, pauses JS polling in background and re-queries on return', () => fixture(async f => {
  assert.equal(f.refreshes(), 1);
  assert.equal(f.intervals(), 1);
  f.tick();
  assert.equal(f.refreshes(), 2);
  f.background();
  assert.equal(f.clears(), 1);
  assert.equal(f.state.isDownloading, true, 'backgrounding must not cancel the native transfer');
  f.tick();
  assert.equal(f.refreshes(), 2);
  await f.foreground();
  assert.equal(f.refreshes(), 3);
  assert.equal(f.intervals(), 2);
}));

test('completion and unmount remove the poller and listeners without canceling downloads', () => fixture(async f => {
  f.state.isDownloading = false;
  f.notify();
  assert.equal(f.clears(), 1);
  f.state.isDownloading = true;
  f.notify();
  assert.equal(f.intervals(), 2);
  f.stop();
  assert.equal(f.subscribed(), false);
  assert.equal(f.clears(), 2);
  assert.equal(f.state.isDownloading, true);
}));

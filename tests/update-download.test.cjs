const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const helpers = createSourceLoader()('src/utils/updateDownload.ts');
const snapshot = overrides => ({ id: '31', version: '1.0.9', downloadUrl: 'https://example.test/update.apk',
  releaseNotes: 'Melhorias', expectedBytes: 1000, receivedBytes: 300, totalBytes: 1000,
  status: 'running', reason: 0, ...overrides });
function fixture(native = {}, version = '1.0.8') {
  const service = { getDownload: async () => snapshot(), startDownload: async () => snapshot(),
    cancelDownload: async () => {}, installDownload: async () => 'opened', ...native };
  return createSourceLoader({
    '@/utils/updateErrors': createSourceLoader()('src/utils/updateErrors.ts'),
    '@/utils/updateDownload': helpers,
    '@/services/updateDownloadService': { updateDownloadService: service },
    'expo-constants': { expoConfig: { version } },
    'react-native': { Platform: { OS: 'android' } },
  })('src/store/useAppUpdateStore.ts').useAppUpdateStore;
}

test('progress handles unknown lengths, invalid values and completion', () => {
  for (const total of [0, -1, NaN, Infinity]) assert.equal(helpers.updateDownloadProgress(300, total), null);
  assert.equal(helpers.updateDownloadProgress(300, 1000), 30);
  assert.equal(helpers.updateDownloadProgress(2000, 1000), 99);
  assert.equal(helpers.updateDownloadProgress(-5, 100), 0);
  assert.equal(helpers.updateDownloadProgress(1000, 1000, true), 100);
});
test('a new process restores download metadata and progress without starting again', async () => {
  let starts = 0;
  const store = fixture({ startDownload: async () => { starts++; return snapshot(); } });
  await store.getState().refreshDownload();
  assert.equal(store.getState().downloadProgress, 30);
  assert.equal(store.getState().isDownloading, true);
  assert.equal(store.getState().downloadInfo.version, '1.0.9');
  await store.getState().downloadAndInstall();
  assert.equal(starts, 0);
});
test('restoring unknown length uses release asset size or indeterminate progress', async () => {
  let value = snapshot({ totalBytes: -1 });
  const store = fixture({ getDownload: async () => value });
  await store.getState().refreshDownload();
  assert.equal(store.getState().downloadProgress, 30);
  value = snapshot({ totalBytes: -1, expectedBytes: 0 });
  await store.getState().refreshDownload();
  assert.equal(store.getState().downloadProgress, null);
  assert.equal(store.getState().downloadedBytes, 300);
});
test('temporary loss of connectivity stays paused and retains bytes, without failure UI', async () => {
  const store = fixture({ getDownload: async () => snapshot({ status: 'paused', reason: 2 }) });
  await store.getState().refreshDownload();
  assert.equal(store.getState().isDownloading, true);
  assert.equal(store.getState().downloadProgress, 30);
  assert.equal(store.getState().downloadError, null);
  assert.match(helpers.updateDownloadWaitingMessage(store.getState().downloadReason), /continuará automaticamente/);
});
test('completion becomes ready without opening an installer in the background', async () => {
  let installs = 0;
  const store = fixture({ getDownload: async () => snapshot({ status: 'complete', receivedBytes: 1000 }), installDownload: async () => { installs++; return 'opened'; } });
  await store.getState().refreshDownload();
  assert.equal(store.getState().downloadProgress, 100);
  assert.equal(store.getState().isDownloading, false);
  assert.equal(installs, 0);
  await store.getState().installDownloadedUpdate();
  assert.equal(installs, 1);
});
test('cancellation invalidates an older progress query', async () => {
  let resolveQuery;
  const store = fixture({ getDownload: () => new Promise(resolve => { resolveQuery = resolve; }) });
  const query = store.getState().refreshDownload();
  await store.getState().cancelDownload();
  resolveQuery(snapshot());
  await query;
  assert.equal(store.getState().downloadStatus, 'idle');
  assert.equal(store.getState().isDownloading, false);
});
test('starting a transfer invalidates an older empty restore', async () => {
  let resolveQuery;
  const store = fixture({ getDownload: () => new Promise(resolve => { resolveQuery = resolve; }) });
  const query = store.getState().refreshDownload();
  store.setState({ updateInfo: snapshot() });
  await store.getState().downloadAndInstall();
  resolveQuery(null);
  await query;
  assert.equal(store.getState().downloadStatus, 'running');
});
test('query failures do not erase an active transfer', async () => {
  const store = fixture({ getDownload: async () => { throw new Error('temporary query failure'); } });
  store.setState({ isDownloading: true, downloadProgress: 64, downloadStatus: 'running' });
  await store.getState().refreshDownload();
  assert.equal(store.getState().downloadProgress, 64);
  assert.equal(store.getState().isDownloading, true);
  assert.equal(store.getState().downloadError, null);
});
test('already installed updates are cleaned without removing other downloads', async () => {
  let canceled = 0;
  const store = fixture({ cancelDownload: async () => { canceled++; } }, '1.0.9');
  await store.getState().refreshDownload();
  assert.equal(canceled, 1);
  assert.equal(store.getState().downloadStatus, 'idle');
});
test('disk full and missing downloads produce friendly recoverable errors', async () => {
  const store = fixture({ getDownload: async () => snapshot({ status: 'failed', reason: 1006 }) });
  await store.getState().refreshDownload();
  assert.match(store.getState().downloadError, /espaço/);
  assert.equal(store.getState().isDownloading, false);
});
test('unknown sources permission preserves the APK for a later installation attempt', async () => {
  const store = fixture({ getDownload: async () => snapshot({ status: 'complete' }), installDownload: async () => 'permission' });
  await store.getState().refreshDownload();
  await store.getState().installDownloadedUpdate();
  assert.equal(store.getState().downloadStatus, 'complete');
  assert.match(store.getState().installMessage, /Permita a instalação/);
});
test('repeated download taps enqueue only one transfer', async () => {
  let starts = 0, finish;
  const store = fixture({ startDownload: () => { starts++; return new Promise(resolve => { finish = resolve; }); } });
  store.setState({ updateInfo: snapshot() });
  const first = store.getState().downloadAndInstall();
  await store.getState().downloadAndInstall();
  finish(snapshot());
  await first;
  assert.equal(starts, 1);
});
test('cancel during enqueue waits for the native ID and removes the newly queued transfer', async () => {
  const calls = [];
  let finish;
  const store = fixture({
    startDownload: () => new Promise(resolve => { finish = resolve; }),
    cancelDownload: async () => { calls.push('cancel'); },
  });
  store.setState({ updateInfo: snapshot() });
  const start = store.getState().downloadAndInstall();
  const cancel = store.getState().cancelDownload();
  await store.getState().downloadAndInstall();
  assert.deepEqual(calls, []);
  finish(snapshot());
  await Promise.all([start, cancel]);
  assert.deepEqual(calls, ['cancel']);
  assert.equal(store.getState().downloadStatus, 'idle');
  assert.equal(store.getState().isRestoringDownload, false);
});

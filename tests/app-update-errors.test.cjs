const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const helper = createSourceLoader()('src/utils/updateErrors.ts');
const offline = () => Promise.reject(new TypeError('Network request failed'));
const release = { version: 'v1.1.0', downloadUrl: 'https://example.test/app.apk', releaseNotes: '' };

async function withStore(fetcher, run, blobOverrides = {}) {
  const previousFetch = global.fetch;
  const previousError = console.error;
  let errors = 0;
  global.fetch = fetcher;
  console.error = () => errors++;
  const blob = {
    fs: { dirs: { DownloadDir: '/downloads', DocumentDir: '/documents' }, ls: async () => [], unlink: async () => {} },
    config: () => ({ fetch: () => ({ progress: () => offline() }) }),
    android: { actionViewIntent: async () => {} },
    ...blobOverrides,
  };
  try {
    const store = createSourceLoader({
      '@/utils/updateErrors': helper,
      'expo-constants': { expoConfig: { version: '1.0.0' } },
      'react-native': { Platform: { OS: 'android' } },
      'react-native-blob-util': blob,
    })('src/store/useAppUpdateStore.ts').useAppUpdateStore;
    await run(store, () => errors);
  } finally { global.fetch = previousFetch; console.error = previousError; }
}

test('offline startup stays silent without update or download error state', () => withStore(offline, async (store, errors) => {
  await store.getState().checkForUpdates({ silent: true });
  assert.equal(store.getState().checkError, null);
  assert.equal(store.getState().downloadError, null);
  assert.equal(store.getState().isChecking, false);
  assert.equal(errors(), 0);
}));
test('manual checking exposes a friendly connection message without native error details', () => withStore(() => Promise.reject(new Error('fetch failed: java.net.UnknownHostException: Unable to resolve host api.github.com')), async store => {
  await store.getState().checkForUpdates();
  assert.match(store.getState().checkError, /A conexão falhou.*internet/);
  assert.doesNotMatch(store.getState().checkError, /UnknownHost|api.github|fetch failed/);
  assert.equal(store.getState().downloadError, null);
}));
test('an update screen joining a silent startup request receives its error without a duplicate fetch', async () => {
  let rejectRequest, calls = 0;
  await withStore(() => { calls++; return new Promise((_resolve, reject) => { rejectRequest = reject; }); }, async store => {
    const startup = store.getState().checkForUpdates({ silent: true });
    const manual = store.getState().checkForUpdates();
    rejectRequest(new TypeError('Network request failed'));
    await Promise.all([startup, manual]);
    assert.equal(calls, 1);
    assert.match(store.getState().checkError, /A conexão falhou/);
  });
});
test('a successful retry clears the connection message and finds the release', async () => {
  let connected = false;
  await withStore(() => connected ? Promise.resolve({ ok: true, json: async () => ({ tag_name: 'v1.1.0', assets: [{ name: 'app.apk', browser_download_url: release.downloadUrl }] }) }) : offline(), async store => {
    await store.getState().checkForUpdates();
    assert.ok(store.getState().checkError);
    connected = true;
    await store.getState().checkForUpdates();
    assert.equal(store.getState().checkError, null);
    assert.equal(store.getState().hasUpdate, true);
    assert.equal(store.getState().updateInfo.downloadUrl, release.downloadUrl);
  });
});
test('offline background checking does not erase a previously known release', () => withStore(offline, async store => {
  store.setState({ hasUpdate: true, updateInfo: release });
  await store.getState().checkForUpdates({ silent: true });
  assert.equal(store.getState().hasUpdate, true);
  assert.deepEqual(store.getState().updateInfo, release);
  assert.equal(store.getState().checkError, null);
}));
test('download connectivity errors stay in the update screen state without console popups', () => withStore(offline, async (store, errors) => {
  store.setState({ hasUpdate: true, updateInfo: release });
  await store.getState().downloadAndInstall();
  assert.match(store.getState().downloadError, /A conexão falhou/);
  assert.equal(store.getState().isDownloading, false);
  assert.equal(errors(), 0);
}));
test('installer promise failures are handled and never expose their technical message', () => withStore(offline, async store => {
  store.setState({ hasUpdate: true, updateInfo: release });
  await store.getState().downloadAndInstall();
  assert.match(store.getState().downloadError, /Não foi possível abrir o instalador/);
  assert.doesNotMatch(store.getState().downloadError, /INSTALL_INTERNAL_ERROR/);
}, {
  config: () => ({ fetch: () => ({ progress: async () => ({ path: () => '/downloads/app.apk' }) }) }),
  android: { actionViewIntent: async () => { throw new Error('INSTALL_INTERNAL_ERROR'); } },
}));
test('server failures receive a readable service message rather than a network diagnosis', () => withStore(async () => ({ ok: false, status: 500 }), async store => {
  await store.getState().checkForUpdates();
  assert.equal(store.getState().checkError, 'Não foi possível verificar as atualizações agora. Tente novamente em instantes.');
}));

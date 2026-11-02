const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { hookRuntime } = require('./hook-runtime.cjs');
const makeShare = id => ({ type: 'media', text: null, webUrl: null, meta: { shareId: id, component: 'com.genly.app.CreatePdfActivity' }, files: [{ path: `file:///cache/${id}.jpg`, mimeType: 'image/jpeg' }] });

function shareSession() {
  const runtime = hookRuntime();
  const listeners = new Map();
  const pending = [makeShare('a'), makeShare('b')];
  const acknowledgements = [];
  let appChange;
  const emit = value => listeners.get('onChange')?.({ value });
  const native = {
    addListener: (name, callback) => { listeners.set(name, callback); return { remove: () => listeners.delete(name) }; },
    getShareIntent: () => { if (pending[0]) emit(pending[0]); },
    clearShareIntent: id => {
      acknowledgements.push(id);
      if (pending[0]?.meta.shareId === id) pending.shift();
      if (pending[0]) emit(pending[0]);
    },
  };
  const load = createSourceLoader({
    react: runtime.react, 'expo-linking': { useLinkingURL: () => null },
    'react-native': { Platform: { OS: 'android' }, AppState: { currentState: 'active', addEventListener: (_name, callback) => { appChange = callback; return { remove() {} }; } } },
    './ExpoShareIntentModule': native,
    './utils': { getScheme: () => 'genly', getShareExtensionKey: () => 'genlyShareKey', parseShareIntent: value => value },
  });
  const hook = load('node_modules/expo-share-intent/build/useShareIntent.js').default;
  runtime.flush(() => hook({ resetOnBackground: false }));
  return { runtime, native, pending, emit, acknowledgements, appChange: state => appChange(state) };
}

test('cold start subscribes before the first native replay, even when it emits synchronously', () => {
  const session = shareSession();
  assert.equal(session.runtime.result().shareIntent.meta.shareId, 'a');
  assert.equal(session.acknowledgements.length, 0);
});
test('chooser/background transitions preserve pending shares until route acknowledgement', () => {
  const session = shareSession();
  session.appChange('background'); session.runtime.flush();
  session.appChange('active'); session.runtime.flush();
  assert.equal(session.runtime.result().shareIntent.meta.shareId, 'a');
  assert.equal(session.acknowledgements.length, 0);
});
test('acknowledging a request cannot erase the next request emitted during reset', () => {
  const session = shareSession();
  session.runtime.result().resetShareIntent();
  session.runtime.flush();
  assert.deepEqual(session.acknowledgements, ['a']);
  assert.equal(session.runtime.result().shareIntent.meta.shareId, 'b');
});
test('a stale reset callback cannot clear a newer shared payload', () => {
  const session = shareSession();
  const staleReset = session.runtime.result().resetShareIntent;
  session.emit(makeShare('b')); session.runtime.flush();
  staleReset(); session.runtime.flush();
  assert.equal(session.runtime.result().shareIntent.meta.shareId, 'b');
  assert.deepEqual(session.acknowledgements, ['a']);
});

test('preloaded PDF screen imports late parameters once and accepts new requests', () => {
  const runtime = hookRuntime();
  const load = createSourceLoader({ react: runtime.react });
  const { useSharedPdfImages } = load('src/hooks/useSharedPdfImages.ts');
  const imports = [], errors = [];
  const onImport = pages => imports.push(pages);
  const onError = error => errors.push(error);
  let uris, id;
  const render = () => useSharedPdfImages(uris, id, onImport, onError);
  runtime.flush(render);
  assert.equal(imports.length, 0);
  uris = JSON.stringify(['file:///one.jpg', 'file:///two.png']); id = 'a';
  runtime.flush(); runtime.flush();
  assert.equal(imports.length, 1);
  assert.deepEqual(imports[0].map(page => page.sourceUri), ['file:///one.jpg', 'file:///two.png']);
  id = 'b'; runtime.flush();
  assert.equal(imports.length, 2);
  assert.equal(errors.length, 0);
});
test('invalid PDF import parameters report an error and do not replace existing pages', () => {
  const runtime = hookRuntime();
  const { useSharedPdfImages } = createSourceLoader({ react: runtime.react })('src/hooks/useSharedPdfImages.ts');
  let imports = 0, errors = 0;
  const accept = () => imports++;
  const reject = () => errors++;
  runtime.flush(() => useSharedPdfImages('[null]', 'a', accept, reject));
  assert.equal(imports, 0);
  assert.equal(errors, 1);
});

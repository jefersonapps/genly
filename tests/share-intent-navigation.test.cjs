const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { activeAppRoute, ShareDelivery, shareDestination, shareRequestId } = createSourceLoader()('src/navigation/shareIntentNavigation.ts');
const { redirectSystemPath } = createSourceLoader()('src/app/+native-intent.tsx');
const images = (id = 'share-1', component = 'CreatePdf') => ({ type: 'media', text: null, webUrl: null,
  meta: { shareId: id, component: `com.genly.app.${component}Activity` },
  files: [{ path: 'file:///cache/a.jpg', mimeType: 'image/jpeg' }, { path: 'file:///cache/b.png', mimeType: 'image/png' }],
});

for (const path of [
  'content://com.whatsapp.provider.media/item/afc90729-d399-4209-92f0-e6acfb888f27',
  'file:///storage/emulated/0/Download/document.pdf',
]) {
  test(`file intent ${path} starts safely and cannot override an active import`, () => {
    assert.equal(redirectSystemPath({ path, initial: true }), '/');
    assert.equal(redirectSystemPath({ path, initial: false }), '');
    const destination = shareDestination({ type: 'file', files: [{ path, mimeType: 'application/pdf' }], meta: { shareId: 'whatsapp-pdf' } });
    assert.equal(destination.pathname, '/tools/pdf-editor');
    assert.equal(destination.params.sharedUri, path);
    assert.equal(destination.params.shareRequestId, 'whatsapp-pdf');
  });
}

test('native file filtering preserves app deep links and widget map sessions', () => {
  for (const path of ['genly://task/42?source=widget', '/task/editor', 'genly://tools/pdf-editor']) {
    assert.equal(redirectSystemPath({ path, initial: true }), path);
    assert.equal(redirectSystemPath({ path, initial: false }), path);
  }
  assert.match(redirectSystemPath({ path: 'genly://tools/mind-map?newMap=1&source=widget', initial: false }), /^\/tools\/mind-map\?.*mapSession=/);
});

test('multiple gallery images retain order, target and request identity', () => {
  const route = shareDestination(images());
  assert.equal(route.pathname, '/tools/pdf-organizer');
  assert.deepEqual(JSON.parse(route.params.imageUris), ['file:///cache/a.jpg', 'file:///cache/b.png']);
  assert.equal(route.params.shareRequestId, 'share-1');
});
test('cold start waits for ready navigation and accepts a request only once', () => {
  const delivery = new ShareDelivery();
  for (const ready of [false, false, false]) assert.equal(delivery.begin('a', ready), false);
  assert.equal(delivery.begin('a', true), true);
  assert.equal(delivery.begin('a', true), false);
  assert.equal(delivery.receive('home'), false);
  assert.equal(delivery.pendingId, 'a');
  assert.equal(delivery.receive('a'), true);
  assert.equal(delivery.pendingId, null);
  assert.equal(delivery.begin('a', true), false);
});

test('cold start waits for the app stack and its index redirect inside the router wrapper', () => {
  const delivery = new ShareDelivery();
  const wrapped = route => ({ routes: [{ name: '__root', state: route && { routes: [route] } }] });
  for (const state of [undefined, wrapped(), wrapped({ name: 'index' })]) {
    const route = activeAppRoute(state);
    const ready = !!route && !['index', 'setup', 'onboarding'].includes(route.name);
    assert.equal(delivery.begin('cold-backup', ready), false);
  }
  // The tabs' index is the home screen, not the root redirect.
  const home = activeAppRoute(wrapped({ name: '(tabs)', state: { routes: [{ name: 'index' }] } }));
  assert.equal(home.name, '(tabs)');
  assert.ok(delivery.begin('cold-backup', true));
  const backup = activeAppRoute(wrapped({ name: 'backup/confirm-backup', params: { shareRequestId: 'cold-backup' } }));
  assert.ok(delivery.receive(backup.params.shareRequestId));
  assert.equal(delivery.pendingId, null);
  assert.equal(delivery.begin('cold-backup', true), false);
});

test('active app route follows focused wrapper routes and supports an unwrapped stack', () => {
  const backup = { name: 'backup/confirm-backup', params: { shareRequestId: 'a' } };
  const stack = { index: 1, routes: [{ name: '(tabs)' }, backup, { name: '(tabs)', isPreloaded: true }] };
  assert.equal(activeAppRoute(stack), backup);
  assert.equal(activeAppRoute({ index: 1, routes: [{ name: 'other' }, { name: '__root', state: { routes: [{ name: '__root', state: stack }] } }] }), backup);
});
test('a later request cannot acknowledge or replace an unreceived request', () => {
  const delivery = new ShareDelivery();
  assert.ok(delivery.begin('a', true));
  assert.equal(delivery.begin('b', true), false);
  assert.equal(delivery.receive('b'), false);
  delivery.empty();
  assert.equal(delivery.pendingId, 'a');
  assert.ok(delivery.receive('a'));
  assert.ok(delivery.begin('b', true));
  assert.ok(delivery.receive('b'));
});
test('an intentional retry keeps the request available after failed navigation', () => {
  const delivery = new ShareDelivery();
  assert.ok(delivery.begin('a', true));
  assert.equal(delivery.begin('a', true), false);
  delivery.retry();
  assert.ok(delivery.begin('a', true));
});
test('sharing identical files again has a distinct native request identity', () => {
  assert.notEqual(shareRequestId(images('a')), shareRequestId(images('b')));
  const delivery = new ShareDelivery();
  assert.ok(delivery.begin('a', true));
  assert.ok(delivery.receive('a'));
  assert.ok(delivery.begin('b', true));
});
test('text shares use the actual text property instead of the nonexistent value property', () => {
  const route = shareDestination({ type: 'text', text: 'ação amanhã', webUrl: null, files: null });
  assert.equal(route.pathname, '/task/editor');
  assert.equal(route.params.sharedText, 'ação amanhã');
});
for (const [component, path, param] of [
  ['Scanner', '/tools/document-scanner', 'imageUris'], ['Ocr', '/tools/ocr-tool', 'imageUri'],
  ['QrReader', '/tools/qr-tool', 'imageUri'], ['EditPdf', '/tools/pdf-editor', 'sharedUri'],
  ['ConvertPdf', '/tools/pdf-to-image', 'fileUri'], ['ColorPicker', '/tools/color-picker', 'sharedUri'],
  ['BackgroundRemover', '/tools/background-remover', 'sharedUri'], ['ImportBackup', '/backup/confirm-backup', 'fileUri'],
]) test(`${component} keeps its explicit native destination`, () => {
  const route = shareDestination(images('a', component));
  assert.equal(route.pathname, path);
  assert.ok(route.params[param]);
});
test('PDFs without a filename extension route by MIME type and invalid shares fail explicitly', () => {
  assert.equal(shareDestination({ ...images(), meta: null, files: [{ path: 'content://file/42', mimeType: 'application/pdf' }] }).pathname, '/tools/pdf-editor');
  assert.throws(() => shareDestination({ type: 'media', files: [], text: null, webUrl: null }), /arquivos acessíveis/);
});

test('late native replay after reset cannot reopen an acknowledged document', () => {
  const delivery = new ShareDelivery();
  assert.ok(delivery.begin('a', true));
  assert.ok(delivery.receive('a'));
  delivery.empty();
  assert.equal(delivery.begin('a', true), false);
  assert.ok(delivery.begin('b', true));
});

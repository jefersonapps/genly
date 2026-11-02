const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { MindMapAutosave, hasMindMapContent } = createSourceLoader()('src/lib/mindmap/autosave.ts');
const { redirectMindMapIntent } = createSourceLoader()('src/navigation/mindMapIntent.ts');
const doc = title => ({ nodes: [{ id: 'root', title }], rootId: 'root', canvasBgColor: null, bgPattern: 'none' });

test('opening or styling an untouched placeholder does not create an empty map', async () => {
  let writes = 0;
  const saver = new MindMapAutosave(null, async () => ++writes, () => {});
  saver.update(doc('Ideia Central'), false);
  await saver.flush();
  assert.equal(writes, 0);
});
test('typing and immediately returning flushes the latest text and creates exactly one map', async () => {
  const calls = [];
  const saver = new MindMapAutosave(null, async (id, value) => { calls.push([id, value]); return 42; }, () => {});
  saver.update(doc('Plano'), true);
  saver.update(doc('Plano de estudos'), true);
  await saver.flush();
  assert.equal(saver.id, 42);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].nodes[0].title, 'Plano de estudos');
  saver.update(doc('Plano revisado'), true);
  await saver.flush();
  assert.equal(calls[1][0], 42);
});
test('edits arriving during creation are serialized as updates to the new ID', async () => {
  let finish;
  const calls = [];
  const saver = new MindMapAutosave(null, async (id, value) => {
    calls.push([id, value.nodes[0].title]);
    if (id === null) await new Promise(resolve => { finish = resolve; });
    return 42;
  }, () => {});
  saver.update(doc('Primeira ideia'), true);
  const first = saver.flush();
  saver.update(doc('Texto final'), true);
  const back = saver.flush();
  finish();
  await Promise.all([first, back]);
  assert.deepEqual(calls, [[null, 'Primeira ideia'], [42, 'Texto final']]);
});
test('existing maps do not write on hydration, but persist text, layout and background changes', async () => {
  const calls = [];
  const saver = new MindMapAutosave(7, async (id, value) => { calls.push([id, value]); return id; }, () => {});
  saver.initialize(doc('Antigo'));
  saver.update(doc('Antigo'), false);
  await saver.flush();
  assert.equal(calls.length, 0);
  saver.update({ ...doc('Novo'), canvasBgColor: '#fff', bgPattern: 'grid', nodes: [{ id: 'root', title: 'Novo', pinnedX: 100 }] }, false);
  await saver.flush();
  assert.equal(calls[0][0], 7);
  assert.equal(calls[0][1].nodes[0].pinnedX, 100);
  assert.equal(calls[0][1].bgPattern, 'grid');
});
test('save failures retain pending content for a later retry', async () => {
  let fail = true;
  const states = [];
  const saver = new MindMapAutosave(null, async () => { if (fail) throw new Error('disk'); return 8; }, state => states.push(state));
  saver.update(doc('Não perder'), true);
  await assert.rejects(saver.flush(), /disk/);
  assert.equal(saver.id, null);
  assert.equal(states.at(-1), 'error');
  fail = false;
  await saver.flush();
  assert.equal(saver.id, 8);
  assert.equal(states.at(-1), 'saved');
});
test('fresh widget entries generate separate sessions and do not reuse a task ID', () => {
  const link = 'genly://tools/mind-map?newMap=1&source=widget&taskId=42';
  const first = redirectMindMapIntent(link);
  const second = redirectMindMapIntent(link);
  assert.notEqual(first, second);
  assert.match(first, /mapSession=/);
  assert.doesNotMatch(first, /taskId=/);
  assert.match(redirectMindMapIntent('genly://tools/mind-map?source=widget'), /mapSession=/);
  assert.equal(redirectMindMapIntent('genly://tools/mind-map?source=widget&taskId=42'), 'genly://tools/mind-map?source=widget&taskId=42');
  assert.equal(redirectMindMapIntent('genly://tools/qr-tool'), 'genly://tools/qr-tool');
});
test('persistence targets the mind maps group, creates once and updates the same note', async () => {
  const calls = [];
  const { saveMindMapDocument } = createSourceLoader({
    '@/lib/mindmap/autosave': { hasMindMapContent },
    './taskService': {
      getGroupByName: async name => { assert.equal(name, 'Mapas Mentais'); return { id: 3 }; },
      createTask: async (...args) => { calls.push(['create', ...args]); return { id: 11 }; },
      updateTask: async (...args) => calls.push(['update', ...args]),
    },
  })('src/services/mindMapPersistence.ts');
  const value = { ...doc('Ideia Central'), nodes: [...doc('Ideia Central').nodes, { id: 'child', title: 'Minha ideia' }] };
  assert.equal(await saveMindMapDocument(null, value), 11);
  await saveMindMapDocument(11, doc('Atualizado'));
  assert.equal(calls[0][1], 'Minha ideia');
  assert.equal(calls[0][3], 3);
  assert.deepEqual(calls[1], ['update', 11, { title: 'Atualizado', content: JSON.stringify(doc('Atualizado')), groupId: 3 }]);
});
test('typing saves automatically after the debounce without any export or back action', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  const saver = new MindMapAutosave(null, async (_id, value) => { calls.push(value); return 42; }, () => {});
  saver.update(doc('Salvar sozinho'), true);
  t.mock.timers.tick(349);
  assert.equal(calls.length, 0);
  t.mock.timers.tick(1);
  assert.equal(calls.length, 1);
  await saver.flush();
  assert.equal(saver.id, 42);
});
test('blank central ideas and generated placeholders never create notes, including after typing then clearing', async () => {
  let writes = 0;
  const saver = new MindMapAutosave(null, async () => ++writes, () => {});
  for (const title of ['', '  ', 'Ideia Central', ' ideia central ']) {
    saver.update(doc(title), true);
    await saver.flush();
  }
  saver.update({ ...doc('Ideia Central'), nodes: [...doc('Ideia Central').nodes, { id: 'child', title: 'Novo tópico' }] }, true);
  await saver.flush();
  saver.update(doc('Rascunho'), true);
  saver.update(doc(''), true);
  await saver.flush();
  assert.equal(writes, 0);
});
test('a meaningful child or an attached image counts as content', async () => {
  const calls = [];
  const saver = new MindMapAutosave(null, async (_id, value) => { calls.push(value); return 17; }, () => {});
  saver.update({ ...doc('Ideia Central'), nodes: [...doc('Ideia Central').nodes, { id: 'child', title: 'Conteúdo real' }] }, true);
  await saver.flush();
  assert.equal(calls.length, 1);
  const imageSaver = new MindMapAutosave(null, async (_id, value) => { calls.push(value); return 18; }, () => {});
  imageSaver.update({ ...doc('Ideia Central'), nodes: [{ id: 'root', title: '', imageUri: 'file:///image.jpg' }] }, false);
  await imageSaver.flush();
  assert.equal(calls.length, 2);
});
test('clearing a saved map removes it, and typing again creates a new record', async () => {
  const calls = [], statuses = [];
  let nextId = 41;
  const saver = new MindMapAutosave(null, async (id, document) => {
    calls.push([id, document.nodes[0].title]);
    return hasMindMapContent(document) ? id ?? ++nextId : null;
  }, status => statuses.push(status));
  saver.update(doc('Ideia com conteúdo'), true);
  await saver.flush();
  assert.equal(saver.id, 42);
  saver.update(doc(''), true);
  await saver.flush();
  assert.equal(saver.id, null);
  assert.equal(statuses.at(-1), 'empty');
  saver.update(doc('Ideia com conteúdo'), true);
  await saver.flush();
  assert.equal(saver.id, 43);
  assert.deepEqual(calls, [[null, 'Ideia com conteúdo'], [42, ''], [null, 'Ideia com conteúdo']]);
});
test('a map cleared during its first write is deleted as soon as creation finishes', async () => {
  let finish;
  const calls = [], statuses = [];
  const saver = new MindMapAutosave(null, async (id, value) => {
    calls.push([id, value.nodes[0].title]);
    if (!hasMindMapContent(value)) return null;
    await new Promise(resolve => { finish = resolve; });
    return 42;
  }, state => statuses.push(state));
  saver.update(doc('Texto'), true);
  const saving = saver.flush();
  saver.update(doc(''), true);
  finish();
  await saving;
  assert.deepEqual(calls, [[null, 'Texto'], [42, '']]);
  assert.equal(saver.id, null);
  assert.equal(statuses.at(-1), 'empty');
});
test('persistence deletes empty existing maps and never creates empty new maps', async () => {
  const deleted = [];
  const { saveMindMapDocument } = createSourceLoader({
    '@/lib/mindmap/autosave': { hasMindMapContent },
    './taskService': {
      getGroupByName: async () => { throw new Error('Must not load/create a group for an empty map'); },
      deleteTask: async id => deleted.push(id),
    },
  })('src/services/mindMapPersistence.ts');
  assert.equal(await saveMindMapDocument(42, doc('')), null);
  assert.equal(await saveMindMapDocument(null, doc('Ideia Central')), null);
  assert.deepEqual(deleted, [42]);
});
test('an already empty map loaded from storage is removed even without further edits', async () => {
  const deleted = [];
  const saver = new MindMapAutosave(42, async (id, value) => {
    assert.equal(hasMindMapContent(value), false);
    deleted.push(id);
    return null;
  }, () => {});
  saver.initialize(doc(''));
  saver.update(doc(''), false);
  await saver.flush();
  assert.deepEqual(deleted, [42]);
  assert.equal(saver.id, null);
});
test('new content arriving during deletion is recreated without updating the removed ID', async () => {
  let finish;
  const calls = [];
  const saver = new MindMapAutosave(42, async (id, value) => {
    calls.push([id, value.nodes[0].title]);
    if (!hasMindMapContent(value)) { await new Promise(resolve => { finish = resolve; }); return null; }
    assert.equal(id, null);
    return 43;
  }, () => {});
  saver.initialize(doc('Antigo'));
  saver.update(doc(''), true);
  const deleting = saver.flush();
  saver.update(doc('Texto novo'), true);
  finish();
  await deleting;
  assert.deepEqual(calls, [[42, ''], [null, 'Texto novo']]);
  assert.equal(saver.id, 43);
});
test('failed deletion remains pending and can be retried before leaving the editor', async () => {
  let fail = true;
  const saver = new MindMapAutosave(42, async () => { if (fail) throw new Error('disk'); return null; }, () => {});
  saver.initialize(doc('Texto'));
  saver.update(doc(''), true);
  await assert.rejects(saver.flush(), /disk/);
  assert.equal(saver.id, 42);
  fail = false;
  await saver.flush();
  assert.equal(saver.id, null);
});

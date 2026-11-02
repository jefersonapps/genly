const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const load = createSourceLoader();
const { libraryCreationRoute } = load('src/navigation/libraryCreation.ts');
const { useLibraryStore } = load('src/store/useLibraryStore.ts');

test('general creates a general note and custom groups preselect their own group', () => {
  assert.deepEqual(libraryCreationRoute(null), { pathname: '/task/editor' });
  assert.deepEqual(libraryCreationRoute({ id: 12, name: 'Projetos' }), {
    pathname: '/task/editor', params: { groupId: '12' },
  });
});

test('mind maps and flashcards open their creators with a fresh session on every tap', () => {
  for (const [name, pathname, sessionKey] of [
    ['Mapas Mentais', '/tools/mind-map', 'mapSession'],
    ['Flashcards', '/tools/flashcards', 'createSession'],
  ]) {
    const first = libraryCreationRoute({ id: 3, name });
    const next = libraryCreationRoute({ id: 3, name });
    assert.equal(first.pathname, pathname);
    assert.equal(first.params.groupId, '3');
    assert.ok(first.params[sessionKey]);
    assert.notEqual(first.params[sessionKey], next.params[sessionKey]);
    assert.equal(first.params.taskId, undefined);
  }
});

test('selection updates synchronously, survives refresh, and follows renames and deletion', () => {
  const store = useLibraryStore;
  store.setState({ selectedGroupId: null, groups: [] });
  store.getState().syncGroups([{ id: 8, name: 'Projetos' }]);
  store.getState().selectGroup(8);
  const selectedRoute = () => {
    const state = store.getState();
    return libraryCreationRoute(state.groups.find(group => group.id === state.selectedGroupId));
  };
  assert.equal(selectedRoute().params.groupId, '8');
  store.getState().syncGroups([{ id: 8, name: 'Flashcards' }]);
  assert.equal(store.getState().selectedGroupId, 8);
  assert.equal(selectedRoute().pathname, '/tools/flashcards');
  store.getState().selectGroup(null);
  assert.deepEqual(selectedRoute(), { pathname: '/task/editor' });
  store.getState().selectGroup(8);
  store.getState().syncGroups([]);
  assert.equal(store.getState().selectedGroupId, null);
  assert.deepEqual(selectedRoute(), { pathname: '/task/editor' });
});

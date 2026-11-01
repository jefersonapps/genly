/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mock, test } = require('node:test');

// The navigation state builders run without a native bridge. Only their
// optional platform configuration needs a substitute in this Node process.
mock.module('expo-constants', {
  defaultExport: { expoConfig: { extra: { router: { adaptiveColors: false, sitemap: false, notFound: false } } } },
});

const expo = path.dirname(require.resolve('expo-router/package.json'));
const { getRoutes } = require(`${expo}/build/getRoutes.js`);
const { getReactNavigationConfig } = require(`${expo}/build/getReactNavigationConfig.js`);
const { getStateFromPath } = require(`${expo}/build/fork/getStateFromPath.js`);
const { createSeededNavigationState } = require(`${expo}/build/global-state/createSeededNavigationState.js`);
const { StackRouter } = require(`${expo}/build/react-navigation/routers/StackRouter.js`);
const { navigateBackOrHome, rootNavigationSettings } = require('../src/navigation/backNavigation.ts');
const { createWidgetLink } = require('../src/widgets/links.ts');

const files = fs.readdirSync(path.join(__dirname, '../src/app'), { recursive: true })
  .filter((name) => /\.(ts|tsx)$/.test(name)).map((name) => `./${name}`);
const context = (key) => ({
  default: () => null,
  ...(key === './_layout.tsx' ? { unstable_settings: rootNavigationSettings } : {}),
});
context.keys = () => files;
const tree = getRoutes(context, {
  platform: 'android', skipGenerated: true, notFound: false, sitemap: false, ignoreEntryPoints: true,
});
const config = getReactNavigationConfig(tree, false);

function launch(uri) {
  const parsed = getStateFromPath(uri.replace(/^genly:\/\//, '/'), config);
  assert.ok(parsed, `route must resolve: ${uri}`);
  let state = createSeededNavigationState(parsed, tree, 'root');
  const stack = StackRouter({ initialRouteName: rootNavigationSettings.anchor });
  const dispatch = (action) => {
    const result = stack.getStateForAction(state, action, { routeGetIdList: {}, routeParamList: {} });
    assert.ok(result?.state, `router must handle ${action.type}`);
    state = result.state;
  };
  return {
    state: () => state,
    push: (name, params) => dispatch({ type: 'PUSH', payload: { name, params } }),
    router: {
      canGoBack: () => state.index > 0,
      back: () => dispatch({ type: 'GO_BACK' }),
      dismissTo: (href) => {
        assert.equal(href, '/(tabs)');
        dispatch({ type: 'POP_TO', payload: { name: '(tabs)' } });
      },
      replace: (href) => {
        assert.equal(href, '/(tabs)');
        dispatch({ type: 'REPLACE', payload: { name: '(tabs)' } });
      },
    },
  };
}

function assertHome(session) {
  assert.deepEqual(session.state().routes.map((route) => route.name), ['(tabs)']);
  assert.equal(session.state().index, 0);
}

for (const [name, route, params, screen] of [
  ['note', '/task/42', {}, 'task/[id]'],
  ['new note', '/task/editor', {}, 'task/editor'],
  ['group note', '/task/editor', { groupId: 7 }, 'task/editor'],
  ['reminder', '/task/editor', { reminderDate: '2026-11-02T09:00:00.000Z' }, 'task/editor'],
  ['mind map', '/tools/mind-map', { taskId: 42 }, 'tools/mind-map'],
  ['new mind map', '/tools/mind-map', {}, 'tools/mind-map'],
  ['flashcards', '/tools/flashcards', { taskId: 42 }, 'tools/flashcards'],
  ['new flashcards', '/tools/flashcards', {}, 'tools/flashcards'],
]) {
  test(`cold widget launch: ${name} has home underneath and returns home`, () => {
    const session = launch(createWidgetLink(route, params));
    assert.deepEqual(session.state().routes.map((item) => item.name), ['(tabs)', screen]);
    const destination = session.state().routes[1];
    assert.equal(destination.params.source, 'widget');
    for (const [key, value] of Object.entries(params)) assert.equal(destination.params[key], String(value));
    navigateBackOrHome(session.router, true);
    assertHome(session);
  });
}

test('old widget links also have a working back destination', () => {
  const session = launch('genly://task/42');
  navigateBackOrHome(session.router, false);
  assertHome(session);
});

test('warm widget entry removes previous note/editor history when leaving', () => {
  const session = launch('genly://task/1');
  session.push('task/editor', { id: '1' });
  session.push('task/[id]', { id: '42', source: 'widget' });
  navigateBackOrHome(session.router, true);
  assertHome(session);
});

test('saving a new widget note returns home instead of another screen', () => {
  const session = launch('genly://tools/flashcards');
  session.push('task/editor', { source: 'widget' });
  navigateBackOrHome(session.router, true);
  assertHome(session);
});

test('normal in-app editing returns to the note being edited', () => {
  const session = launch('genly://task/42');
  session.push('task/editor', { id: '42' });
  navigateBackOrHome(session.router, false);
  assert.deepEqual(session.state().routes.map((route) => route.name), ['(tabs)', 'task/[id]']);
  assert.equal(session.state().routes[1].params.id, '42');
});

test('an isolated destination recovers to home without a back stack', () => {
  const isolated = {
    ...tree,
    loadRoute: () => ({ default: () => null }),
  };
  const state = createSeededNavigationState({ routes: [{ name: 'task/editor' }] }, isolated, 'isolated');
  assert.equal(state.routes.length, 1);
  // Use the real stack reducer for the fallback replacement as well.
  const stack = StackRouter({});
  let recovered;
  navigateBackOrHome({
    canGoBack: () => false,
    back: () => assert.fail('cannot go back from an isolated route'),
    dismissTo: () => assert.fail('legacy entry has no widget source marker'),
    replace: () => { recovered = stack.getStateForAction(state, { type: 'REPLACE', payload: { name: '(tabs)' } }, { routeGetIdList: {}, routeParamList: {} }).state; },
  }, false);
  assert.deepEqual(recovered.routes.map((route) => route.name), ['(tabs)']);
});

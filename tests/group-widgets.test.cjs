const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { drizzle } = require('drizzle-orm/sqlite-proxy');
const { createSourceLoader } = require('./load-source.cjs');

function configurationFixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE settings (id INTEGER PRIMARY KEY, key TEXT UNIQUE, value TEXT);');
  const db = drizzle(async (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    statement.setReturnArrays(true);
    if (method === 'run') { statement.run(...params); return { rows: [] }; }
    return { rows: method === 'get' ? statement.get(...params) : statement.all(...params) };
  });
  const groups = new Map([[11, 7], [12, 8]]);
  const service = createSourceLoader({
    '../db/client': { db },
    './groupWidgetService': { getPinnedWidgetGroupId: async id => groups.get(id) },
  })('src/services/widgetDataService.ts');
  return { sqlite, service };
}

test('pinned widget instances restore different groups independently', async () => {
  const { sqlite, service } = configurationFixture();
  try {
    assert.equal(await service.getWidgetConfig(11), 7);
    assert.equal(await service.getWidgetConfig(12), 8);
    assert.equal(await service.getWidgetConfig(99), undefined);
  } finally { sqlite.close(); }
});
test('manual reconfiguration overrides the original pinned group and deletion removes only its config', async () => {
  const { sqlite, service } = configurationFixture();
  try {
    await service.saveWidgetConfig(11, 9);
    await service.saveWidgetConfig(12, 10);
    assert.equal(await service.getWidgetConfig(11), 9);
    await service.deleteWidgetConfig(11);
    assert.deepEqual(sqlite.prepare('SELECT key, value FROM settings').all().map(row => [row.key, row.value]), [['widget_group_12', '10']]);
  } finally { sqlite.close(); }
});

function rendererFixture() {
  const calls = [];
  const groups = new Map([[7, { id: 7, name: 'Estudos', emoji: 'note', color: '#123456' }], [8, { id: 8, name: 'Viagem', emoji: 'note', color: '#456789' }]]);
  const api = createSourceLoader({
    'react-native-android-widget': { requestWidgetUpdate() {}, FlexWidget() {}, TextWidget() {}, ListWidget() {} },
    '../services/widgetDataService': {
      getThemeSettings: async () => ({ themeMode: 'light', primaryColor: '#123456' }),
      getGroupById: async id => groups.get(id),
      getRecentByGroup: async id => { calls.push(id); return [{ id: id * 10, title: `Nota do grupo ${id}` }]; },
      getAllWidgetGroups: async () => { throw new Error('Must not select an arbitrary group'); },
      deleteWidgetConfig: async id => calls.push(['delete', id]),
    },
  })('src/widgets/widget-task-handler.tsx');
  return { ...api, calls };
}

test('custom widgets keep group identity and filter the notes by that group', async () => {
  const api = rendererFixture();
  const first = await api.getThemedWidget('GroupWidget', 7);
  const second = await api.getThemedWidget('GroupWidget', 8);
  assert.equal(first.props.group.name, 'Estudos');
  assert.equal(first.props.tasks[0].id, 70);
  assert.equal(second.props.group.name, 'Viagem');
  assert.equal(second.props.tasks[0].id, 80);
  assert.deepEqual(api.calls, [7, 8]);
});
test('unconfigured or deleted groups do not show another group or all recent notes', async () => {
  const api = rendererFixture();
  for (const id of [undefined, 999]) {
    const widget = await api.getThemedWidget('GroupWidget', id);
    assert.equal(widget.props.title, 'Escolha um grupo');
    assert.equal(widget.props.tasks, undefined);
  }
  assert.deepEqual(api.calls, []);
});
test('removing a group widget cleans only its own saved association', async () => {
  const api = rendererFixture();
  await api.widgetTaskHandler({ widgetAction: 'WIDGET_DELETED', widgetInfo: { widgetName: 'GroupWidget', widgetId: 11 } });
  await api.widgetTaskHandler({ widgetAction: 'WIDGET_DELETED', widgetInfo: { widgetName: 'RecentTasks', widgetId: 12 } });
  assert.deepEqual(api.calls, [['delete', 11]]);
});
test('pin requests pass the exact group and do not claim launcher acceptance is user confirmation', async () => {
  const calls = [];
  const api = createSourceLoader({
    'react-native': { Platform: { OS: 'android' } },
    'expo-modules-core': { requireOptionalNativeModule: () => ({
      requestGroupWidget: async (id, name) => { calls.push([id, name]); return true; },
      getGroupId: async id => id === 11 ? 7 : 0,
    }) },
  })('src/services/groupWidgetService.ts');
  assert.equal(await api.requestGroupWidget(7, 'Meu grupo'), true);
  assert.deepEqual(calls, [[7, 'Meu grupo']]);
  assert.equal(await api.getPinnedWidgetGroupId(11), 7);
  assert.equal(await api.getPinnedWidgetGroupId(12), undefined);
  await assert.rejects(api.requestGroupWidget(0, 'Inválido'), /Invalid group/);
});
test('unsupported launcher/module returns a graceful manual-add fallback', async () => {
  const api = createSourceLoader({
    'react-native': { Platform: { OS: 'android' } },
    'expo-modules-core': { requireOptionalNativeModule: () => null },
  })('src/services/groupWidgetService.ts');
  assert.equal(await api.requestGroupWidget(7, 'Estudos'), false);
  assert.equal(await api.getPinnedWidgetGroupId(11), undefined);
});
test('pin callback winning during initial widget render does not leave an unconfigured placeholder', async () => {
  let reads = 0, rendered;
  const group = { id: 7, name: 'Estudos', emoji: 'note', color: '#123456' };
  const api = createSourceLoader({
    'react-native-android-widget': { FlexWidget() {}, TextWidget() {}, ListWidget() {} },
    '../services/widgetDataService': {
      getThemeSettings: async () => ({ themeMode: 'light', primaryColor: '#123456' }),
      getWidgetConfig: async () => ++reads === 1 ? undefined : 7,
      getGroupById: async () => group,
      getRecentByGroup: async () => [{ id: 70, title: 'Minha nota' }],
    },
  })('src/widgets/widget-task-handler.tsx');
  await api.widgetTaskHandler({ widgetAction: 'WIDGET_ADDED', widgetInfo: { widgetName: 'GroupWidget', widgetId: 11 }, renderWidget: value => { rendered = value; } });
  assert.equal(rendered.props.group.id, 7);
  assert.equal(rendered.props.tasks[0].id, 70);
});

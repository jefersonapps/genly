const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { drizzle } = require('drizzle-orm/sqlite-proxy');
const { createSourceLoader } = require('./load-source.cjs');

test('headless entry registers widgets without loading app or configuration screens', async () => {
  let main, background, configure;
  let headlessCalls = 0;
  let uiCalls = 0;
  const load = createSourceLoader({
    '@expo/metro-runtime': {},
    expo: { registerRootComponent: (component) => { main = component; } },
    'react-native': { Platform: { OS: 'android' } },
    'react-native-android-widget': {
      registerWidgetTaskHandler: (handler) => { background = handler; },
      registerWidgetConfigurationScreen: (component) => { configure = component; },
    },
    './src/widgets/widget-task-handler': { widgetTaskHandler: async () => { headlessCalls++; } },
    get './src/widgets/WidgetConfigurationScreen'() { uiCalls++; return { WidgetConfigurationScreen: () => null }; },
    get './src/App'() { uiCalls++; return { default: () => null }; },
    get 'expo-router/entry'() { return assert.fail('headless entry loaded the router'); },
  });
  load('index.ts');
  assert.equal(uiCalls, 0);
  assert.equal(headlessCalls, 0);
  await background({ widgetAction: 'WIDGET_ADDED' });
  assert.equal(headlessCalls, 1);
  assert.equal(uiCalls, 0);
  main();
  assert.equal(uiCalls, 1);
  configure({});
  assert.equal(uiCalls, 2);
});

test('production widget JSX bypasses NativeWind runtime and React Compiler hooks', () => {
  const babel = require('@babel/core');
  for (const filename of ['src/widgets/RecentTasksWidget.tsx', 'src/widgets/widget-task-handler.tsx']) {
    const { code } = babel.transformFileSync(filename, { envName: 'production' });
    assert.match(code, /require\("react\/jsx-runtime"\)/);
    assert.ok(!code.includes('nativewind/jsx-runtime'));
    assert.ok(!code.includes('react/compiler-runtime'));
  }
});

function widgetService() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE groups (id INTEGER PRIMARY KEY, name TEXT, emoji TEXT, color TEXT, created_at TEXT);
    CREATE TABLE tasks (id INTEGER PRIMARY KEY, group_id INTEGER, title TEXT, content TEXT,
      delivery_date TEXT, delivery_time TEXT, created_at TEXT, updated_at TEXT, completed INTEGER);
    CREATE TABLE settings (id INTEGER PRIMARY KEY, key TEXT UNIQUE, value TEXT);
  `);
  const queries = [];
  const db = drizzle(async (sql, params, method) => {
    queries.push(sql);
    const statement = sqlite.prepare(sql);
    statement.setReturnArrays(true);
    if (method === 'run') { statement.run(...params); return { rows: [] }; }
    return { rows: method === 'get' ? statement.get(...params) : statement.all(...params) };
  });
  const load = createSourceLoader({ '../db/client': { db } });
  const service = load('src/services/widgetDataService.ts');
  return { sqlite, queries, service };
}

test('recent notes preserve filtering/order/limit in one query without loading note bodies', async () => {
  const { sqlite, queries, service } = widgetService();
  try {
    sqlite.exec(`INSERT INTO groups VALUES (1, 'Mapas Mentais', '', '', ''), (2, 'Flashcards', '', '', ''), (3, 'Estudos', '', '', '');`);
    const insert = sqlite.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, 0)');
    for (const [id, group] of [[1, null], [2, 3], [3, 1], [4, 2]]) {
      insert.run(id, group, `Nota ${id}`, 'large note body '.repeat(10000), `2026-11-0${id}`, `2026-11-0${id}`);
    }
    const notes = await service.getRecentTasks(1);
    assert.deepEqual(notes.map((note) => note.id), [2]);
    assert.deepEqual(Object.keys(notes[0]).sort(), ['completed', 'deliveryDate', 'deliveryTime', 'id', 'title']);
    assert.equal(queries.length, 1);
    assert.ok(!queries[0].includes('content'));
    sqlite.exec('DELETE FROM groups');
    assert.equal((await service.getRecentTasks(10)).length, 4);
  } finally { sqlite.close(); }
});

test('widget theme reads only display settings and keeps defaults', async () => {
  const { sqlite, queries, service } = widgetService();
  try {
    assert.deepEqual(await service.getThemeSettings(), { themeMode: 'system', primaryColor: '#208AEF' });
    sqlite.exec(`INSERT INTO settings (key, value) VALUES ('theme_mode', 'dark'), ('primary_color', '#123456'), ('profile_name', 'ignored');`);
    assert.deepEqual(await service.getThemeSettings(), { themeMode: 'dark', primaryColor: '#123456' });
    assert.ok(queries.every((sql) => sql.includes('where')));
    await service.saveWidgetConfig(12, 3);
    assert.equal(await service.getWidgetConfig(12), 3);
  } finally { sqlite.close(); }
});

test('adding notes starts content and theme reads together and skips group configuration', async () => {
  let resolveTheme;
  let configReads = 0;
  let contentStarted = false;
  const theme = new Promise((resolve) => { resolveTheme = resolve; });
  const load = createSourceLoader({
    'react-native-android-widget': { requestWidgetUpdate() {}, FlexWidget() {}, TextWidget() {}, ListWidget() {} },
    '../services/widgetDataService': {
      getThemeSettings: () => theme,
      getRecentTasks: async () => { contentStarted = true; return [{ id: 1, title: 'Nota' }]; },
      getWidgetConfig: async () => { configReads++; },
    },
  });
  const { widgetTaskHandler } = load('src/widgets/widget-task-handler.tsx');
  let rendered;
  const pending = widgetTaskHandler({ widgetAction: 'WIDGET_ADDED', widgetInfo: { widgetName: 'RecentTasks', widgetId: 12 }, renderWidget: (element) => { rendered = element; } });
  assert.ok(contentStarted);
  assert.equal(configReads, 0);
  resolveTheme({ themeMode: 'system', primaryColor: '#208AEF' });
  await pending;
  assert.equal(rendered.light.props.tasks[0].title, 'Nota');
  assert.ok(rendered.dark);
});

test('an unavailable database renders an actionable widget instead of staying blank', async () => {
  const load = createSourceLoader({
    'react-native-android-widget': { requestWidgetUpdate() {}, FlexWidget() {}, TextWidget() {}, ListWidget() {} },
    '../services/widgetDataService': {
      getThemeSettings: async () => { throw new Error('database not initialized'); },
      getRecentTasks: async () => [],
    },
  });
  const { widgetTaskHandler } = load('src/widgets/widget-task-handler.tsx');
  let rendered;
  await widgetTaskHandler({ widgetAction: 'WIDGET_ADDED', widgetInfo: { widgetName: 'RecentTasks', widgetId: 12 }, renderWidget: (element) => { rendered = element; } });
  assert.equal(rendered.light.type(rendered.light.props).props.clickAction, 'OPEN_APP');
});

test('native initial layouts replace transparent providers and remain idempotent', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'genly-widget-layout-'));
  const config = require('../app.json').expo;
  const widgets = config.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'react-native-android-widget')[1].widgets;
  let apply;
  const load = createSourceLoader({ 'expo/config-plugins': { withFinalizedMod: (value, [, action]) => { apply = action; return value; } } });
  try {
    const res = path.join(directory, 'app/src/main/res');
    await fs.mkdir(path.join(res, 'xml'), { recursive: true });
    for (const widget of widgets) {
      await fs.writeFile(path.join(res, 'xml', `widgetprovider_${widget.name.toLowerCase()}.xml`), '<appwidget-provider android:initialLayout="@layout/rn_widget" />');
    }
    load('plugins/withWidgetLoadingLayouts.js')(config);
    await apply({ modRequest: { platformProjectRoot: directory } });
    for (const widget of widgets) {
      const name = widget.name.toLowerCase();
      const provider = await fs.readFile(path.join(res, 'xml', `widgetprovider_${name}.xml`), 'utf8');
      assert.ok(provider.includes(`@layout/genly_widget_initial_${name}`));
      if (widget.name === 'GroupWidget') {
        assert.ok(provider.includes('android:previewLayout="@layout/genly_group_widget_preview"'));
        assert.ok(!provider.includes('android:previewImage'));
        assert.equal(widget.previewImage, undefined);
      }
      const layout = await fs.readFile(path.join(res, 'layout', `genly_widget_initial_${name}.xml`), 'utf8');
      assert.ok(layout.includes('ProgressBar') && layout.includes('Carregando'));
    }
    const beforeGroup = await fs.readFile(path.join(res, 'xml/widgetprovider_groupwidget.xml'), 'utf8');
    const before = await fs.readFile(path.join(res, 'xml/widgetprovider_recenttasks.xml'), 'utf8');
    await apply({ modRequest: { platformProjectRoot: directory } });
    assert.equal(await fs.readFile(path.join(res, 'xml/widgetprovider_recenttasks.xml'), 'utf8'), before);
    assert.equal(await fs.readFile(path.join(res, 'xml/widgetprovider_groupwidget.xml'), 'utf8'), beforeGroup);
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

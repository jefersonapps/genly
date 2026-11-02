const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');

function devToolsEnvironment(dev, run) {
  const previous = global.__DEV__;
  global.__DEV__ = dev;
  const effects = [], jobs = [], ignored = [];
  let openings = 0;
  const load = createSourceLoader({
    react: { useEffect: effect => effects.push(effect) },
    'react-native': {
      Platform: { OS: 'android' },
      LogBox: { ignoreLogs: patterns => ignored.push(...patterns) },
      TurboModuleRegistry: { get: () => ({ openDebugger: () => openings++ }) },
    },
    '@/utils/idle': { scheduleIdleTask: task => { jobs.push(task); return () => {}; } },
  });
  try {
    const { useDevelopmentTools } = load('src/dev/useDevelopmentTools.ts');
    run({ useDevelopmentTools, effects, jobs, ignored, openings: () => openings });
  } finally {
    if (previous === undefined) delete global.__DEV__;
    else global.__DEV__ = previous;
  }
}

test('opens DevTools once per runtime without hiding actual app errors', () => devToolsEnvironment(true, ({ useDevelopmentTools, effects, jobs, ignored, openings }) => {
  useDevelopmentTools(); useDevelopmentTools();
  effects.forEach(effect => effect());
  assert.equal(openings(), 0);
  jobs.forEach(job => job());
  assert.equal(openings(), 1);
  assert.ok(ignored.some(pattern => pattern.test('Open debugger to view warnings.')));
  assert.ok(ignored.every(pattern => !pattern.test('An actual app error')));
}));

test('release builds do not open DevTools or filter any logs', () => devToolsEnvironment(false, ({ useDevelopmentTools, effects, jobs, ignored, openings }) => {
  useDevelopmentTools();
  effects.forEach(effect => effect());
  assert.equal(jobs.length, 0);
  assert.equal(ignored.length, 0);
  assert.equal(openings(), 0);
}));

test('predictive back plugin preserves Android 13–15 back dispatch and is idempotent', () => {
  let apply;
  const load = createSourceLoader({ '@expo/config-plugins': { withMainActivity: (config, action) => { apply = action; return config; } } });
  load('plugins/withPredictiveBackCompatibility.js')({});
  const original = 'package com.genly.app\nimport android.os.Build\nclass MainActivity { override fun onCreate() { super.onCreate(null) } }';
  const config = { modResults: { language: 'kt', contents: original } };
  const once = apply(config).modResults.contents;
  assert.equal(apply(config).modResults.contents, once);
  assert.match(once, /Build.VERSION.SDK_INT in 33\.\.35/);
  assert.match(once, /OnBackInvokedCallback \{ onBackPressed\(\) \}/);
  const app = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo;
  assert.equal(app.android.predictiveBackGestureEnabled, true);
  assert.ok(app.plugins.includes('./plugins/withPredictiveBackCompatibility.js'));
});

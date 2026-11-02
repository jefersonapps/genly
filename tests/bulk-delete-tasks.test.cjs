const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { SQLiteSyncDialect } = require('drizzle-orm/sqlite-core');
const { createSourceLoader } = require('./load-source.cjs');

function fixture(failAtBatch = 0) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE tasks (id INTEGER PRIMARY KEY);
    CREATE TABLE attachments (task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE);
    WITH RECURSIVE ids(id) AS (SELECT 1 UNION ALL SELECT id+1 FROM ids WHERE id<1100)
      INSERT INTO tasks SELECT id FROM ids;
    INSERT INTO attachments VALUES (1), (2), (3);`);
  const dialect = new SQLiteSyncDialect();
  const reminders = [];
  let refreshes = 0;
  let batches = 0;
  const db = { transaction(callback) {
    sqlite.exec('BEGIN');
    try {
      callback({ delete() { return { where(condition) { return { run() {
        if (++batches === failAtBatch) throw new Error('simulated storage failure');
        const query = dialect.sqlToQuery(condition);
        sqlite.prepare(`DELETE FROM tasks WHERE ${query.sql}`).run(...query.params);
      } }; } }; } });
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } };
  const { deleteTasks } = createSourceLoader({
    '../db/client': { db },
    './notificationService': { NotificationService: { cancelReminder: async id => reminders.push(id) } },
    './widgetRefreshService': { refreshAllWidgets: () => refreshes++ },
  })('src/services/taskService.ts');
  return { sqlite, deleteTasks, reminders, refreshes: () => refreshes, batches: () => batches };
}

test('bulk deletion removes only selected notes and their attachments, cancels reminders and refreshes widgets once', async () => {
  const f = fixture();
  try {
    await f.deleteTasks([1, 3, 3]);
    assert.deepEqual(f.sqlite.prepare('SELECT id FROM tasks WHERE id <= 3').all().map(x => x.id), [2]);
    assert.deepEqual(f.sqlite.prepare('SELECT task_id FROM attachments').all().map(x => x.task_id), [2]);
    assert.deepEqual(f.reminders, [1, 3]);
    assert.equal(f.refreshes(), 1);
  } finally { f.sqlite.close(); }
});

test('empty selection does not write or refresh', async () => {
  const f = fixture();
  try {
    await f.deleteTasks([]);
    assert.deepEqual(f.reminders, []);
    assert.equal(f.batches(), 0);
    assert.equal(f.refreshes(), 0);
  } finally { f.sqlite.close(); }
});

test('large selections are batched below SQLite parameter limits', async () => {
  const f = fixture();
  try {
    await f.deleteTasks(Array.from({ length: 1100 }, (_, i) => i + 1));
    assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM tasks').get().n, 0);
    assert.equal(f.batches(), 3);
    assert.equal(f.refreshes(), 1);
  } finally { f.sqlite.close(); }
});

test('storage failure rolls back all batches, preserving notes and attachments', async () => {
  const f = fixture(2);
  try {
    await assert.rejects(f.deleteTasks(Array.from({ length: 1100 }, (_, i) => i + 1)), /storage failure/);
    assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM tasks').get().n, 1100);
    assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM attachments').get().n, 3);
    assert.equal(f.refreshes(), 0);
  } finally { f.sqlite.close(); }
});

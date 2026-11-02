const assert = require('node:assert/strict');
const { test } = require('node:test');
const { DatabaseSync } = require('node:sqlite');
const { drizzle } = require('drizzle-orm/sqlite-proxy');
const { createSourceLoader } = require('./load-source.cjs');

function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`CREATE TABLE tasks (id INTEGER PRIMARY KEY, group_id INTEGER, title TEXT, content TEXT,
    delivery_date TEXT, delivery_time TEXT, created_at TEXT, updated_at TEXT, completed INTEGER DEFAULT 0);
    INSERT INTO tasks VALUES (1, NULL, 'Antiga', 'Conteúdo', NULL, NULL, '2020-01-01', '2020-01-01', 0),
      (2, NULL, 'Recente', '', NULL, NULL, '2021-01-01', '2021-01-01', 0);`);
  const db = drizzle(async (sql, params, method) => {
    const statement = sqlite.prepare(sql);
    statement.setReturnArrays(true);
    if (method === 'run') { statement.run(...params); return { rows: [] }; }
    return { rows: method === 'get' ? statement.get(...params) : statement.all(...params) };
  });
  const notifications = [];
  const service = createSourceLoader({
    '../db/client': { db },
    './notificationService': { NotificationService: {
      cancelReminder: async id => notifications.push(['cancel', id]),
      scheduleReminder: async id => notifications.push(['schedule', id]),
    } },
    './widgetRefreshService': { refreshAllWidgets() {} },
  })('src/services/taskService.ts');
  return { sqlite, service, notifications };
}

test('completing and reopening preserve saved timestamps and order after reloading', async () => {
  const { sqlite, service, notifications } = fixture();
  try {
    await service.completeTask(1);
    assert.equal((await service.getTaskById(1)).completed, 1);
    assert.equal((await service.getTaskById(1)).updatedAt, '2020-01-01');
    assert.deepEqual((await service.getAllTasks()).map(task => task.id), [2, 1]);
    sqlite.exec("UPDATE tasks SET delivery_date = '2099-01-01', delivery_time = '10:00' WHERE id = 1");
    await service.uncompleteTask(1);
    assert.equal((await service.getTaskById(1)).completed, 0);
    assert.equal((await service.getTaskById(1)).updatedAt, '2020-01-01');
    assert.deepEqual((await service.getAllTasks()).map(task => task.id), [2, 1]);
    assert.deepEqual(notifications, [['cancel', 1], ['schedule', 1]]);
  } finally { sqlite.close(); }
});
test('group and reminder changes, including an unchanged full editor form, preserve recency', async () => {
  const { sqlite, service } = fixture();
  try {
    await service.updateTask(1, { title: 'Antiga', content: 'Conteúdo', groupId: 3, deliveryDate: '2099-01-01', deliveryTime: '10:00' });
    await service.bulkUpdateTasksGroup([1, 2], 4);
    const tasks = await service.getAllTasks();
    assert.deepEqual(tasks.map(task => [task.id, task.updatedAt, task.groupId]), [[2, '2021-01-01', 4], [1, '2020-01-01', 4]]);
    assert.equal(tasks[1].deliveryTime, '10:00');
  } finally { sqlite.close(); }
});
for (const data of [{ title: 'Título editado' }, { content: 'Conteúdo editado' }]) {
  test(`an actual ${Object.keys(data)[0]} edit moves the task to the top`, async () => {
    const { sqlite, service } = fixture();
    try {
      await service.updateTask(1, data);
      const tasks = await service.getAllTasks();
      assert.deepEqual(tasks.map(task => task.id), [1, 2]);
      assert.notEqual(tasks[0].updatedAt, '2020-01-01');
      for (const [key, value] of Object.entries(data)) assert.equal(tasks[0][key], value);
    } finally { sqlite.close(); }
  });
}
test('empty legacy content and unchanged fields do not count as a text edit', async () => {
  const { sqlite, service } = fixture();
  try {
    sqlite.exec('UPDATE tasks SET content = NULL WHERE id = 1');
    await service.updateTask(1, { title: 'Antiga', content: '' });
    await service.updateTask(1, { groupId: 1 });
    assert.equal((await service.getTaskById(1)).updatedAt, '2020-01-01');
  } finally { sqlite.close(); }
});

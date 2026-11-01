const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { decodeNoteText, stripMarkdown, htmlToMarkdown, truncateText } = createSourceLoader()('src/utils/markdown.ts');

test('preserves literal Portuguese accents and normalizes combining accents', () => {
  assert.equal(decodeNoteText('ação, título, amanhã, café, avó'), 'ação, título, amanhã, café, avó');
  assert.equal(decodeNoteText('ac\u0327a\u0303o e cafe\u0301'), 'ação e café');
});

test('decodes named, decimal and hex entities in note titles and HTML previews', () => {
  const encoded = 'a&ccedil;&atilde;o, t&iacute;tulo, amanh&atilde;, caf&#233;, av&#xF3;';
  const expected = 'ação, título, amanhã, café, avó';
  assert.equal(decodeNoteText(encoded), expected);
  assert.equal(stripMarkdown(`<p>${encoded}</p>`), expected);
  assert.equal(htmlToMarkdown(`<p>${encoded}</p>`), expected);
});

test('preserves Unicode symbols outside the BMP and escaped literal text', () => {
  assert.equal(decodeNoteText('&#x1D49C; &#119964; &lt;literal&gt; &amp;'), '𝒜 𝒜 <literal> &');
  assert.equal(stripMarkdown('<p>&lt;tag&gt; &amp; a&ccedil;&atilde;o&nbsp;final</p>'), '<tag> & ação final');
});

test('keeps a readable compact preview without HTML or markdown layout', () => {
  assert.equal(stripMarkdown('<p><strong>Reuni&atilde;o</strong></p><p>**Próxima** etapa</p>'), 'Reunião Próxima etapa');
  assert.equal(stripMarkdown(''), '');
  assert.equal(truncateText('abc𝒜texto', 4), 'abc…');
  assert.equal(truncateText('ação', 10), 'ação');
});

test('loads attachments for many notes in one query and groups them correctly', async () => {
  const { DatabaseSync } = require('node:sqlite');
  const { drizzle } = require('drizzle-orm/sqlite-proxy');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('CREATE TABLE media (id INTEGER PRIMARY KEY, task_id INTEGER, uri TEXT, type TEXT, latex_source TEXT, latex_style TEXT, thumbnail_uri TEXT, created_at TEXT)');
  const insert = sqlite.prepare("INSERT INTO media VALUES (?, ?, ?, 'image', NULL, NULL, NULL, '')");
  for (let id = 1; id <= 200; id++) insert.run(id, Math.ceil(id / 2), `file:///image-${id}.png`);
  let queryCount = 0;
  const db = drizzle(async (sql, params) => {
    queryCount++;
    const statement = sqlite.prepare(sql);
    statement.setReturnArrays(true);
    return { rows: statement.all(...params) };
  });
  const load = createSourceLoader({
    '../db/client': { db },
    './notificationService': { NotificationService: {} },
    './widgetRefreshService': { refreshAllWidgets() {} },
  });
  try {
    const { getAllTaskMedia } = load('src/services/taskService.ts');
    const result = await getAllTaskMedia();
    assert.equal(queryCount, 1);
    assert.equal(Object.keys(result).length, 100);
    assert.deepEqual(result[1].map(item => item.id), [1, 2]);
    assert.deepEqual(result[100].map(item => item.id), [199, 200]);
    assert.equal(result[1][0].uri, 'file:///image-1.png');
    sqlite.exec('DELETE FROM media');
    assert.deepEqual(await getAllTaskMedia(), {});
  } finally { sqlite.close(); }
});

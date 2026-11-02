const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { parsePdfPageRange } = createSourceLoader()('src/utils/pdfPageRange.ts');

test('inclusive page range keeps the first and last selected pages', () => {
  const range = parsePdfPageRange('1', '5', 10);
  assert.deepEqual(range, { valid: true, startIndex: 0, endIndex: 5, count: 5 });
  const pages = Array.from({ length: 10 }, (_, i) => i + 1);
  assert.deepEqual(pages.slice(range.startIndex, range.endIndex), [1, 2, 3, 4, 5]);
});

test('supports a single page, the last page and the whole document', () => {
  assert.deepEqual(parsePdfPageRange('5', '5', 5), { valid: true, startIndex: 4, endIndex: 5, count: 1 });
  assert.deepEqual(parsePdfPageRange('1', '1', 1), { valid: true, startIndex: 0, endIndex: 1, count: 1 });
  assert.deepEqual(parsePdfPageRange(' 1 ', '05', 5), { valid: true, startIndex: 0, endIndex: 5, count: 5 });
});

test('rejects missing, fractional, reversed and out-of-bounds ranges', () => {
  for (const [from, to, total] of [
    ['', '5', 5], ['1', '', 5], ['0', '5', 5], ['-1', '5', 5],
    ['1.5', '5', 5], ['1e1', '5', 5], ['2', '1', 5], ['1', '6', 5],
    ['6', '6', 5], ['1', '1', 0], ['9007199254740992', '9007199254740992', 10],
  ]) {
    assert.equal(parsePdfPageRange(from, to, total).valid, false, `${from}–${to} of ${total}`);
  }
});

test('slicing current order retains source indices, images and rotations', () => {
  const pages = [
    { id: 'c', sourceUri: 'one.pdf', pageIndex: 8, rotation: 90 },
    { id: 'a', sourceUri: 'image.jpg', pageIndex: 0, rotation: 180, isImage: true },
    { id: 'b', sourceUri: 'two.pdf', pageIndex: 3, rotation: 270 },
  ];
  const range = parsePdfPageRange('2', '3', pages.length);
  const selected = pages.slice(range.startIndex, range.endIndex);
  assert.deepEqual(selected, [pages[1], pages[2]]);
  assert.equal(selected[0], pages[1]);
  assert.equal(pages.length, 3);
});

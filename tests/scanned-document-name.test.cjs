const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { normalizeScannedDocumentName } = createSourceLoader()('src/utils/scannedDocumentName.ts');

test('document names preserve accents, spaces and normalized Unicode', () => {
  assert.equal(normalizeScannedDocumentName('  Contrato de locação  '), 'Contrato de locação');
  assert.equal(normalizeScannedDocumentName('Declarac\u0327a\u0303o'), 'Declaração');
});
test('names have one automatic extension and cannot contain a path', () => {
  assert.equal(normalizeScannedDocumentName('Contrato.PDF.pdf.'), 'Contrato');
  assert.equal(normalizeScannedDocumentName('Página.jpg'), 'Página');
  assert.equal(normalizeScannedDocumentName('../Recibos: aluguel?'), 'Recibos aluguel');
  for (const name of ['', '  ', '...', '.pdf', '/\\<>:*?|']) assert.equal(normalizeScannedDocumentName(name), '');
});

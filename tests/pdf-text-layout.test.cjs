const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { PDFDocument, PDFRawStream, decodePDFRawStream } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { createSourceLoader } = require('./load-source.cjs');
const { layoutAnnotationText } = createSourceLoader()('src/lib/pdfEditor/textLayout.ts');
const fontBytes = fs.readFileSync('assets/fonts/Montserrat-Medium.ttf');

async function embedFont(document) {
  document.registerFontkit(fontkit);
  return document.embedFont(fontBytes, { subset: true });
}
const metrics = PDFDocument.create().then(embedFont);
const box = { content: '_'.repeat(240), width: 260, height: 100, fontSize: 12 };

test('continuous underscores wrap within the same padded width used by the preview', async () => {
  const font = await metrics;
  const layout = layoutAnnotationText(box, font);
  assert.ok(layout.lines.length > 1);
  assert.equal(layout.lines.map(line => line.text).join(''), box.content);
  for (const line of layout.lines) {
    assert.ok(line.x + line.width <= box.width - 4 + 0.001);
    assert.equal(line.width, font.widthOfTextAtSize(line.text, box.fontSize));
  }
  const wider = layoutAnnotationText({ ...box, width: 400 }, font);
  assert.ok(wider.lines.length < layout.lines.length);
});

test('manual line breaks, empty lines, accents and long words survive layout', async () => {
  const font = await metrics;
  const content = 'Aplicação amanhã\r\n\r\n' + 'palavramuitolonga'.repeat(12);
  const layout = layoutAnnotationText({ ...box, width: 120, content }, font);
  assert.ok(layout.lines.some(line => line.text === ''));
  assert.equal(layout.lines.map(line => line.text).join(''), content.replace(/\r\n/g, ''));
  for (const line of layout.lines) assert.ok(line.width <= 112 + 0.001);
  for (let i = 1; i < layout.lines.length; i++) {
    assert.ok(Math.abs(layout.lines[i].baseline - layout.lines[i - 1].baseline - layout.lineHeight) < 0.001);
  }
});

for (const viewWidth of [300, 450]) {
  test(`actual PDF export embeds Montserrat and preserves every preview baseline at view width ${viewWidth}`, async () => {
    const source = await PDFDocument.create();
    source.addPage([595.28, 841.89]);
    const input = await source.saveAsBase64();
    const { exportEditedPdf } = createSourceLoader({
      'expo-file-system/legacy': { EncodingType: { Base64: 'base64' }, readAsStringAsync: async () => input },
      './annotationFont': { embedAnnotationFont: embedFont },
    })('src/lib/pdfEditor/pdfExportUtils.ts');
    const annotation = { ...box, id: 'underlines', page: 0, type: 'text', x: 20, y: 180, rotation: 0, fontColor: '#8a3333' };
    const output = await exportEditedPdf('file:///source.pdf', [annotation], [], { width: viewWidth, height: 600 });
    assert.ok(output);
    const exported = await PDFDocument.load(output);
    const page = exported.getPages()[0];
    const streams = page.node.Contents();
    const operators = Array.from({ length: streams.size() }, (_, i) =>
      Buffer.from(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode()).toString()).join('\n');
    const positions = [...operators.matchAll(/1 0 0 1 ([-\d.e]+) ([-\d.e]+) Tm/g)].map(match => [Number(match[1]), Number(match[2])]);
    const layout = layoutAnnotationText(annotation, await metrics);
    assert.equal(positions.length, layout.lines.length);
    assert.equal((operators.match(/ Tj/g) || []).length, layout.lines.length);
    const scale = 595.28 / viewWidth;
    for (let i = 0; i < positions.length; i++) {
      assert.ok(Math.abs(positions[i][0] - (annotation.x + layout.lines[i].x) * scale) < 0.001);
      assert.ok(Math.abs(positions[i][1] - (841.89 - (annotation.y + layout.lines[i].baseline) * scale)) < 0.001);
    }
    const fonts = page.node.Resources().lookup(require('pdf-lib').PDFName.of('Font'));
    assert.match(fonts.toString(), /Montserrat/);
  });
}

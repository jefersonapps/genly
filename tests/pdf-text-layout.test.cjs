const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const { PDFDocument, PDFRawStream, decodePDFRawStream } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const { createSourceLoader } = require('./load-source.cjs');
const { layoutAnnotationText } = createSourceLoader()('src/lib/pdfEditor/textLayout.ts');
const { shapeBounds } = createSourceLoader()('src/lib/pdfEditor/drawingTools.ts');
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

test('font choice, size one and custom line spacing are preserved in the actual PDF', async () => {
  const source = await PDFDocument.create();
  const pageHeight = 1300;
  source.addPage([595.28, pageHeight]);
  const input = await source.saveAsBase64();
  const registered = [];
  const assets = Object.fromEntries(['Montserrat-Medium', 'Montserrat-Regular', 'Montserrat-Bold', 'DejaVuSerif', 'DejaVuSansMono', 'Arimo-Regular', 'Tinos-Regular', 'Roboto-Regular', 'Lato-Regular']
    .map(name => [`../../../assets/fonts/${name}.ttf`, `assets/fonts/${name}.ttf`]));
  const load = createSourceLoader({ ...assets,
    'expo-font': { loadAsync: async fonts => registered.push(...Object.keys(fonts)) },
    'expo-asset': { Asset: { fromModule: localUri => ({ localUri, downloadAsync: async () => {} }) } },
    'expo-file-system/legacy': { EncodingType: { Base64: 'base64' }, readAsStringAsync: async uri => uri.endsWith('.ttf') ? fs.readFileSync(uri).toString('base64') : input },
  });
  const { exportEditedPdf } = load('src/lib/pdfEditor/pdfExportUtils.ts');
  const { loadAnnotationPreviewFont } = load('src/lib/pdfEditor/annotationFont.ts');
  const families = ['Montserrat-Medium', 'Montserrat-Regular', 'Montserrat-Bold', 'PdfSerif', 'PdfMono', 'PdfArimo', 'PdfTinos', 'PdfRoboto', 'PdfLato'];
  const annotations = families.map((fontFamily, index) => ({ ...box, page: 0, type: 'text', x: 20, y: 30 + index * 120,
    fontFamily, content: 'ação\n\namanhã', fontSize: index === 0 ? 1 : 12, lineSpacing: 0.8 + index * 0.2 }));
  const output = await exportEditedPdf('source.pdf', annotations, [], { width: 595.28, height: pageHeight });
  assert.ok(output);
  assert.deepEqual(registered, families);
  const document = await PDFDocument.load(output);
  const page = document.getPages()[0];
  const streams = page.node.Contents();
  const operators = Array.from({ length: streams.size() }, (_, i) => Buffer.from(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode()).toString()).join('\n');
  const positions = [...operators.matchAll(/1 0 0 1 ([-\d.e]+) ([-\d.e]+) Tm/g)].map(match => [Number(match[1]), Number(match[2])]);
  const expected = [];
  for (const annotation of annotations) {
    const font = await loadAnnotationPreviewFont(annotation.fontFamily);
    const layout = layoutAnnotationText(annotation, font);
    assert.ok(Math.abs(layout.lines[1].baseline - layout.lines[0].baseline - annotation.fontSize * annotation.lineSpacing) < 0.001);
    for (const line of layout.lines) if (line.text) expected.push([annotation.x + line.x, pageHeight - annotation.y - line.baseline]);
  }
  assert.equal(positions.length, expected.length);
  positions.forEach((position, index) => position.forEach((coordinate, axis) => assert.ok(Math.abs(coordinate - expected[index][axis]) < 0.001)));
  assert.match(operators, / 1 Tf/);
  const resources = page.node.Resources().lookup(require('pdf-lib').PDFName.of('Font')).toString();
  for (const font of ['Montserrat-Medium', 'Montserrat-Regular', 'Montserrat-Bold', 'DejaVuSerif', 'DejaVuSansMono', 'Arimo', 'Tinos', 'Roboto-Regular', 'Lato-Regular']) assert.ok(resources.includes(font));
});

for (const strokeWidth of [7, 0.1, 0.3]) test(`circle, rectangle and line exports preserve brush color and thickness ${strokeWidth}`, async () => {
  const source = await PDFDocument.create();
  source.addPage([600, 800]);
  const input = await source.saveAsBase64();
  const { exportEditedPdf } = createSourceLoader({
    'expo-file-system/legacy': { EncodingType: { Base64: 'base64' }, readAsStringAsync: async () => input },
    './annotationFont': { embedAnnotationFont: embedFont },
  })('src/lib/pdfEditor/pdfExportUtils.ts');
  const annotations = ['circle', 'rectangle', 'line'].map(kind => ({ page: 0, type: 'shape',
    ...shapeBounds({ kind, start: { x: 20, y: 30 }, end: { x: 120, y: 130 } }), strokeColor: '#cc3300', strokeWidth }));
  const output = await exportEditedPdf('source.pdf', annotations, [], { width: 300, height: 400 });
  const page = (await PDFDocument.load(output)).getPages()[0];
  const streams = page.node.Contents();
  const operators = Array.from({ length: streams.size() }, (_, i) => Buffer.from(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode()).toString()).join('\n');
  assert.equal((operators.match(/0\.8 0\.2 0 RG/g) || []).length, 3);
  assert.equal(operators.split('\n').filter(line => line === `${strokeWidth} w`).length, 3);
  assert.equal((operators.match(/2 0 0 -2 0 0 cm/g) || []).length, 3);
  assert.equal((operators.match(/^S$/gm) || []).length, 3);
});

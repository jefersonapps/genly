const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PDFDocument, PDFRawStream, decodePDFRawStream } = require('pdf-lib');
const { createSourceLoader } = require('./load-source.cjs');
const { renderedPageFrame, renderedObjectBounds, previewPageCorrection, insertPageGeometry } = createSourceLoader()('src/lib/pdfEditor/previewGeometry.ts');
const { shapeBounds } = createSourceLoader()('src/lib/pdfEditor/drawingTools.ts');

test('pixel-rounded native page frames preserve document points including centered offsets', () => {
  const pdf = { width: 581, height: 779 };
  const view = { width: 384, height: 779 * 384 / 581 };
  const frame = renderedPageFrame(view, { width: 384, height: 1448 / 2.8125 }, { width: 1079, height: 1448 }, 2.8125);
  assert.ok(frame.x > 0);
  const correction = previewPageCorrection(pdf, frame);
  const s = pdf.width / view.width;
  for (const point of [{ x: 0, y: 0 }, { x: 27.1791, y: 681.5591 }, { x: 581, y: 779 }]) {
    const previewX = frame.x + point.x / pdf.width * frame.width;
    const previewY = frame.y + point.y / pdf.height * frame.height;
    const x = previewX * s * correction.scaleX + correction.x;
    const y = (pdf.height - previewY * s) * correction.scaleY + correction.y;
    assert.ok(Math.abs(x - point.x) < 1e-9);
    assert.ok(Math.abs(y - (pdf.height - point.y)) < 1e-9);
  }
});

test('measured object bounds retain native pixel rounding while rejecting stale layouts', () => {
  const item = { x: 8.551158, y: 440.3, width: 20, height: 42.15, content: 'retained' };
  const measured = { x: 8.533333, y: 440.177777, width: 19.911111, height: 42.311111 };
  assert.deepEqual(renderedObjectBounds(item, measured, 2.8125), { ...item, ...measured });
  assert.equal(renderedObjectBounds(item, { ...measured, x: 100 }, 2.8125), item);
  assert.equal(renderedObjectBounds(item, undefined, 2.8125), item);
  assert.deepEqual(insertPageGeometry({ 0: 'first', 1: 'second' }, 1), { 0: 'first', 2: 'second' });
});

function pathPoints(operators) {
  let matrix = [1, 0, 0, 1, 0, 0], values = [];
  const stack = [], points = [];
  for (const token of operators.trim().split(/\s+/)) {
    if (/^[-+]?\d*\.?\d+(?:e[-+]?\d+)?$/i.test(token)) { values.push(Number(token)); continue; }
    if (token === 'q') stack.push([...matrix]);
    else if (token === 'Q') matrix = stack.pop() || [1, 0, 0, 1, 0, 0];
    else if (token === 'cm') {
      const [a,b,c,d,e,f] = matrix, [g,h,i,j,k,l] = values.slice(-6);
      matrix = [a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];
    } else if (token === 'm' || token === 'l') {
      const [x,y] = values.slice(-2), [a,b,c,d,e,f] = matrix;
      points.push({ x: a*x+c*y+e, y: b*x+d*y+f });
    }
    values = [];
  }
  return points;
}

test('actual PDF export maps lines through each page native frame rather than the last page width', async () => {
  const source = await PDFDocument.create();
  const sizes = [{ width: 581, height: 779 }, { width: 842, height: 595 }];
  sizes.forEach(size => source.addPage([size.width, size.height]));
  const input = await source.saveAsBase64();
  const { exportEditedPdf } = createSourceLoader({
    'expo-file-system/legacy': { EncodingType: { Base64: 'base64' }, readAsStringAsync: async () => input },
    './annotationFont': { embedAnnotationFont: () => assert.fail('no annotation fonts needed') },
  })('src/lib/pdfEditor/pdfExportUtils.ts');
  const frames = [
    renderedPageFrame({ width: 384, height: 779 * 384 / 581 }, { width: 384, height: 1448 / 2.8125 }, { width: 1079, height: 1448 }, 2.8125),
    renderedPageFrame({ width: 300, height: 595 * 300 / 842 }, { width: 844 / 2.8125, height: 596 / 2.8125 }, { width: 843, height: 595 }, 2.8125),
  ];
  const point = { x: 27.1791, y: 681.5591 };
  const annotations = frames.map((frame, index) => {
    const start = { x: frame.x + point.x / sizes[index].width * frame.width,
      y: frame.y + (index ? 200 : point.y) / sizes[index].height * frame.height };
    return { id: `line-${index}`, type: 'shape', page: index, strokeColor: '#ee4444', strokeWidth: 0.5,
      ...shapeBounds({ kind: 'line', start, end: { x: start.x, y: start.y + 20 } }) };
  });
  const output = await exportEditedPdf('source.pdf', annotations, [], { width: 300, height: 212 }, {},
    { pixelRatio: 2.8125, pages: Object.fromEntries(frames.map((frame, index) => [index, frame])), objects: {} });
  const document = await PDFDocument.load(output);
  for (const [index, page] of document.getPages().entries()) {
    const streams = page.node.Contents();
    const operators = Array.from({ length: streams.size() }, (_, i) => Buffer.from(decodePDFRawStream(streams.lookup(i, PDFRawStream)).decode()).toString()).join('\n');
    const [first] = pathPoints(operators);
    assert.ok(Math.abs(first.x - point.x) < 1e-8);
    assert.ok(Math.abs(first.y - (sizes[index].height - (index ? 200 : point.y))) < 1e-8);
  }
});

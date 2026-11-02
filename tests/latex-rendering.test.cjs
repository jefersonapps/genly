const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { decode } = require('html-entities');
const { createSourceLoader } = require('./load-source.cjs');
const load = createSourceLoader({ 'expo-file-system': {} });
const { normalizeEquation, getEquationEngineScript, equationScriptValue } = load('src/utils/equationRendering.ts');
const { buildCaptureHtml, DEFAULT_LATEX_STYLE } = load('src/utils/latexCapture.ts');

// Optional browser integration: CHROME_BIN can point to any Chromium installation.
const chrome = process.env.CHROME_BIN || 'google-chrome';
let hasChrome = false;
try { execFileSync(chrome, ['--version'], { stdio: 'ignore' }); hasChrome = true; } catch {}

function runHtml(html) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'genly-equation-'));
  try {
    const filename = path.join(dir, 'test.html');
    fs.writeFileSync(filename, html);
    const output = execFileSync(chrome, ['--headless', '--no-sandbox', '--disable-gpu',
      '--disable-dev-shm-usage', `--user-data-dir=${path.join(dir, 'chrome')}`,
      '--virtual-time-budget=8000', '--dump-dom', `file://${filename}`],
      { encoding: 'utf8', maxBuffer: 12 * 1024 * 1024, timeout: 20000, stdio: ['ignore', 'pipe', 'pipe'] });
    const result = output.match(/<pre id="test-result">([\s\S]*?)<\/pre>/);
    assert.ok(result?.[1], 'Browser must finish rendering');
    return JSON.parse(decode(result[1]));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('matching delimiters preserve environments, labels and special characters', () => {
  const equation = String.raw`\begin{equation}x<y\label{eq}\end{equation}`;
  for (const [start, end] of [['$$', '$$'], ['$', '$'], ['\\[', '\\]'], ['\\(', '\\)']]) {
    assert.equal(normalizeEquation(`${start} ${equation} ${end}`), equation);
  }
  assert.equal(normalizeEquation(equation), equation);
  assert.ok(!equationScriptValue('</script>').includes('<'));
});

test('real SVG renderer keeps labels separate, stable, and inside the viewport', { skip: !hasChrome }, () => {
  const cases = [
    String.raw`\begin{equation}x+y=3\label{eq}\end{equation}`,
    String.raw`\begin{equation}x+y=4\label{eq}\end{equation}`,
    String.raw`\begin{equation*}x+y=3\end{equation*}`,
    String.raw`\begin{align}x+y&=3\label{first}\\2x+y&=5\label{second}\end{align}`,
    String.raw`\begin{equation}\begin{aligned}x+y&=3\\2x+y&=5\end{aligned}\label{eq}\end{equation}`,
    String.raw`\begin{equation}x<y\tag{A}\label{eq}\end{equation}\quad\eqref{eq}`,
    String.raw`\frac{a+b}{\sqrt{c}}`,
    String.raw`\begin{equation}\sum_{i=1}^{n}x_i+x_2+x_3+x_4+x_5+x_6+x_7+x_8+x_9=100\label{long}\end{equation}`,
  ];
  const result = runHtml(`<!doctype html><html><head><script>${getEquationEngineScript()}</script></head>
    <body><div id="host" style="width:600px;font-size:20px"></div><pre id="test-result"></pre><script>
    (async function() { try {
      const results = [];
      const host = document.getElementById('host');
      for (const source of ${JSON.stringify(cases).replace(/</g, '\\u003c')}) {
        host.style.width = '600px';
        const svg = await renderEquationSvg(source, host, 20, '#a040c0');
        const rect = svg.getBoundingClientRect();
        const labels = [...svg.querySelectorAll('g[data-labels] > g[data-mml-node="mtd"]')];
        const rows = [...svg.querySelectorAll('g[data-mml-node="mlabeledtr"] > g[data-mml-node="mtd"]')];
        const separated = labels.every((label, i) => !rows[i] || rows[i].getBoundingClientRect().right + 1 < label.getBoundingClientRect().left);
        const inside = [...svg.querySelectorAll('use')].every(item => {
          const r = item.getBoundingClientRect();
          return r.left >= rect.left - 1 && r.right <= rect.right + 1 && r.top >= rect.top - 1 && r.bottom <= rect.bottom + 1;
        });
        host.style.width = '200px';
        const after = svg.getBoundingClientRect();
        results.push({separated, inside, width: rect.width, height: rect.height,
          labels: labels.length, stable: Math.abs(rect.width - after.width) < 0.1,
          assistive: host.querySelectorAll('mjx-assistive-mml').length,
          nestedSvg: svg.querySelectorAll('svg').length,
          firstLabel: labels[0]?.querySelector('use[data-c="31"]') != null});
      }
      document.getElementById('test-result').textContent = JSON.stringify({results});
    } catch (error) { document.getElementById('test-result').textContent = JSON.stringify({error: error.stack}); } })();
    </script></body></html>`);
  assert.equal(result.error, undefined);
  assert.equal(result.results.length, cases.length);
  for (const [i, value] of result.results.entries()) {
    assert.ok(value.width > 0 && value.height > 0, cases[i]);
    assert.ok(value.separated, `number overlaps equation: ${cases[i]}`);
    assert.ok(value.inside, `glyph clipped: ${cases[i]}`);
    assert.ok(value.stable, `responsive viewport moved: ${cases[i]}`);
    assert.equal(value.assistive, 0);
    assert.equal(value.nestedSvg, 0);
  }
  assert.equal(result.results[0].labels, 1);
  assert.equal(result.results[1].firstLabel, true, 'editing keeps equation number at 1');
  assert.equal(result.results[2].labels, 0, 'starred environments are unnumbered');
  assert.equal(result.results[3].labels, 2, 'align numbers each row');
});

test('numbered equation exports to a nonempty PNG with the same label renderer', { skip: !hasChrome }, () => {
  const html = buildCaptureHtml(String.raw`\begin{equation}x+y=3\label{eq}\end{equation}`,
    DEFAULT_LATEX_STYLE, false).replace('<body>', `<body><pre id="test-result"></pre><script>
      window.ReactNativeWebView = { postMessage(message) {
        const result = JSON.parse(message);
        if (result.png) { result.pngLength = result.png.length; delete result.png; }
        document.getElementById('test-result').textContent = JSON.stringify(result);
      }};
    </script>`);
  const result = runHtml(html);
  assert.equal(result.type, 'capture_result', result.error);
  assert.ok(result.pngLength > 1000);
  assert.ok(result.width > 0 && result.height > 0);
});

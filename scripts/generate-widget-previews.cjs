#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { buildPreviews } = require('./widget-preview-renderer.cjs');

const root = path.resolve(__dirname, '..');
function main() {
  const candidates = [process.env.WIDGET_PREVIEW_BROWSER, 'google-chrome', 'chromium', 'chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
  const browser = candidates.find(candidate => spawnSync(candidate, ['--version'], { encoding: 'utf8' }).status === 0);
  if (!browser) throw new Error('Instale Chrome/Chromium ou defina WIDGET_PREVIEW_BROWSER com o caminho do navegador.');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'genly-widget-previews-'));
  try {
    const previews = buildPreviews();
    for (const preview of previews) {
      const html = path.join(directory, `${preview.widgetName}.html`);
      const png = path.join(directory, preview.filename);
      fs.writeFileSync(html, preview.html);
      const result = spawnSync(browser, [
        '--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
        '--disable-extensions', '--disable-background-networking', '--disable-sync',
        `--user-data-dir=${path.join(directory, 'chrome')}`, '--force-device-scale-factor=1',
        '--default-background-color=00000000', '--hide-scrollbars', '--virtual-time-budget=1500',
        `--window-size=${preview.width},${preview.height}`, `--screenshot=${png}`, `file://${html}`,
      ], { encoding: 'utf8', timeout: 30000 });
      if (result.status !== 0 || !fs.existsSync(png)) throw new Error(`Falha ao renderizar ${preview.widgetName}: ${result.error?.message || result.stderr}`);
      const bytes = fs.readFileSync(png);
      if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.readUInt32BE(16) !== preview.width || bytes.readUInt32BE(20) !== preview.height) throw new Error(`PNG inválido: ${preview.filename}`);
    }
    // Replace the existing assets only after every preview was generated successfully.
    for (const preview of previews) {
      const dest = path.join(root, 'assets/widget-preview', preview.filename);
      fs.copyFileSync(path.join(directory, preview.filename), dest);
      process.stdout.write(`Gerado: assets/widget-preview/${preview.filename}\n`);
      const res = path.join(root, 'android/app/src/main/res');
      const provider = path.join(res, 'xml', `widgetprovider_${preview.widgetName.toLowerCase()}.xml`);
      if (fs.existsSync(provider)) {
        // Gradle can be called without prebuild: keep this checkout's generated
        // Android resources in sync too, without touching signing configuration.
        const resource = `${preview.widgetName.toLowerCase()}_preview`;
        fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
        fs.copyFileSync(dest, path.join(res, 'drawable', `${resource}.png`));
        let xml = fs.readFileSync(provider, 'utf8').replace(/\s+android:previewImage="[^"]*"/g, '');
        if (preview.widgetName === 'GroupWidget') xml = xml.replace(/\s+android:previewLayout="[^"]*"/g, '');
        xml = xml.replace('<appwidget-provider', `<appwidget-provider android:previewImage="@drawable/${resource}"`);
        fs.writeFileSync(provider, xml);
      }
    }
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
try { main(); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }

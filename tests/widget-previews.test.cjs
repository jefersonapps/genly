const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { buildPreviews, browserStyle } = require('../scripts/widget-preview-renderer.cjs');

test('native widget layout primitives retain dimensions, padding, borders and flex in HTML', () => {
  const style = browserStyle({ width: 'match_parent', height: 'wrap_content', flex: 1,
    paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#123456' });
  assert.equal(style.width, '100%');
  assert.equal(style.height, 'auto');
  assert.equal(style.paddingLeft, 12);
  assert.equal(style.paddingRight, 12);
  assert.equal(style.paddingTop, 8);
  assert.equal(style.paddingBottom, 8);
  assert.equal(style.borderStyle, 'solid');
  assert.equal(style.flexBasis, 0);
});
test('every picker preview is generated from a live widget component with SVG icons and local fonts', () => {
  const previews = buildPreviews(new Date(2026, 10, 2, 12));
  const widgets = require('../app.json').expo.plugins.find(entry => Array.isArray(entry) && entry[0] === 'react-native-android-widget')[1].widgets;
  assert.equal(previews.length, widgets.length);
  for (const widget of widgets) {
    const preview = previews.find(value => value.widgetName === widget.name);
    assert.ok(preview, widget.name);
    assert.equal(widget.previewImage, `./assets/widget-preview/${preview.filename}`);
    assert.ok(preview.markup.includes('<svg'), 'render current icon components');
    assert.doesNotMatch(preview.markup, />\+<\//, 'add icon must not depend on font baseline');
    assert.match(preview.html, /font-family:'Montserrat-SemiBold'/);
    const png = fs.readFileSync(path.join(__dirname, '../assets/widget-preview', preview.filename));
    assert.equal(png.readUInt32BE(16), preview.width);
    assert.equal(png.readUInt32BE(20), preview.height);
  }
  const reminders = previews.find(value => value.widgetName === 'Reminders');
  assert.match(reminders.markup, /Amanhã/);
  assert.match(reminders.markup, /Expirado/);
  const group = previews.find(value => value.widgetName === 'GroupWidget');
  assert.match(group.markup, /Meu grupo/);
  assert.doesNotMatch(group.markup, /Trabalho/);
});

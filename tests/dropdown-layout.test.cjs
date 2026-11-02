const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { dropdownLayout, anchorInDropdownWindow } = createSourceLoader()('src/utils/dropdownLayout.ts');
const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const defaults = { anchor: { x: 250, y: 350, width: 50, height: 36 }, viewport: { width: 340, height: 440 }, insets, width: 220, contentHeight: 320, align: 'end' };
function fits(frame, viewport, safe = insets) {
  assert.ok(frame.left >= safe.left + 10 - 0.01);
  assert.ok(frame.top >= safe.top + 10 - 0.01);
  assert.ok(frame.left + frame.width <= viewport.width - safe.right - 10 + 0.01);
  assert.ok(frame.top + frame.height <= viewport.height - safe.bottom - 10 + 0.01);
  assert.ok(frame.width > 0 && frame.height > 0);
}

test('a bottom dropdown in a popup flips upward instead of clipping its options', () => {
  const frame = dropdownLayout(defaults);
  assert.equal(frame.direction, 'top');
  assert.equal(frame.top + frame.height, defaults.anchor.y - 8);
  fits(frame, defaults.viewport);
});
test('a short menu keeps its preferred direction when it fits', () => {
  const args = { ...defaults, anchor: { x: 100, y: 180, width: 50, height: 36 }, contentHeight: 80 };
  const frame = dropdownLayout(args);
  assert.equal(frame.direction, 'bottom');
  assert.equal(frame.height, 80);
  fits(frame, args.viewport);
});
test('a tall menu is height-limited so the scroll container can reveal all options', () => {
  const args = { ...defaults, anchor: { x: 220, y: 170, width: 50, height: 36 }, viewport: { width: 320, height: 340 }, contentHeight: 900 };
  const frame = dropdownLayout(args);
  assert.ok(frame.height < 320);
  fits(frame, args.viewport);
});
test('an explicit top preference flips down near the top of the window', () => {
  const args = { ...defaults, anchor: { x: 100, y: 20, width: 50, height: 36 }, direction: 'top' };
  const frame = dropdownLayout(args);
  assert.equal(frame.direction, 'bottom');
  fits(frame, args.viewport);
});
test('narrow popup windows constrain menu width and respect safe areas on every edge', () => {
  const args = { ...defaults, viewport: { width: 160, height: 230 }, insets: { top: 15, right: 5, bottom: 20, left: 5 }, anchor: { x: 120, y: 150, width: 30, height: 30 } };
  for (const align of ['start', 'center', 'end']) {
    const frame = dropdownLayout({ ...args, align });
    assert.equal(frame.width, 130);
    fits(frame, args.viewport, args.insets);
  }
});
test('screen/window offsets are removed before positioning a popup menu', () => {
  assert.deepEqual(anchorInDropdownWindow({ x: 350, y: 750, width: 50, height: 36 }, { x: 100, y: 400 }), defaults.anchor);
});
test('very short windows allow a scrollable menu to overlap the trigger', () => {
  const args = { ...defaults, viewport: { width: 220, height: 100 }, anchor: { x: 100, y: 30, width: 50, height: 40 } };
  const frame = dropdownLayout(args);
  assert.ok(frame.height >= 48);
  fits(frame, args.viewport);
});
test('resizing and off-window anchors keep the resulting menu inside actual modal bounds', () => {
  for (const width of [140, 240, 400]) for (const height of [100, 220, 700]) {
    for (const x of [-30, 60, 500]) for (const y of [-30, 70, 900]) {
      const viewport = { width, height };
      for (const direction of ['top', 'bottom']) fits(dropdownLayout({ ...defaults, viewport, anchor: { x, y, width: 50, height: 36 }, direction }), viewport);
    }
  }
});

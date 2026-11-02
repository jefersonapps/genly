const assert = require('node:assert/strict');
const { test } = require('node:test');
const React = require('react');
const { createSourceLoader } = require('./load-source.cjs');

function fixture() {
  const events = [];
  const { SwipeableTaskRow } = createSourceLoader({
    react: { ...React, memo: fn => fn, useCallback: fn => fn, useLayoutEffect() {}, useRef: () => ({ current: null }) },
    'react-native': { View: 'view', Text: 'text', TouchableOpacity: 'touch', StyleSheet: { create: value => value } },
    '@/components/task/TaskCard': { TaskCard: 'card' },
    '@/providers/ThemeProvider': { useTheme: () => ({ primaryColor: '#123456', resolvedTheme: 'dark' }) },
    '@/utils/colors': { withOpacity: color => color },
    'expo-router': { useRouter: () => ({ push: route => events.push(['navigate', route]) }) },
    'lucide-react-native': { Check: 'check', Pencil: 'pencil', Trash2: 'trash' },
    './NoteSwipeable': { NoteSwipeable: 'swipe' },
  })('src/components/task/SwipeableTaskRow.tsx');
  const task = { id: 7, title: 'Nota selecionada' };
  const props = { task, kind: 'note', activeRow: { current: null },
    onDelete: () => events.push('delete'), onToggleComplete: () => events.push('complete'),
    onStartSelection: value => events.push(['start', value.id]), onSelect: value => events.push(['select', value.id]) };
  return { render: extra => SwipeableTaskRow({ ...props, ...extra }), events };
}
function find(node, type) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node;
  return React.Children.toArray(node.props?.children).map(child => find(child, type)).find(Boolean) || null;
}

test('holding a note starts selection without navigating or completing it', () => {
  const f = fixture();
  find(f.render(), 'card').props.onLongPress();
  assert.deepEqual(f.events, [['start', 7]]);
});

test('selection disables the mounted swipe and enables an accessible left checkbox', () => {
  const f = fixture();
  const row = f.render({ selectionMode: true, selected: true });
  assert.equal(find(row, 'swipe').props.enabled, false);
  const checkbox = find(row, 'touch');
  assert.equal(checkbox.props.accessibilityRole, 'checkbox');
  assert.deepEqual(checkbox.props.accessibilityState, { checked: true });
  checkbox.props.onPress();
  assert.deepEqual(f.events, [['select', 7]]);
  assert.equal(find(row, 'card').props.hideStatusControl, true);
});

test('recycled rows receive the current checkbox state and can return to normal navigation', () => {
  const f = fixture();
  assert.equal(find(f.render({ selectionMode: true, selected: false }), 'touch').props.accessibilityState.checked, false);
  const normal = f.render({ selectionMode: false });
  assert.ok(find(normal, 'swipe'));
  find(normal, 'card').props.onPress();
  assert.deepEqual(f.events, [['navigate', '/task/7']]);
});

// React retains native views, thumbnail images and gesture resources only when
// the ancestor types/keys stay the same across the selection transition.
function pathTo(node, type, path = []) {
  if (!node || typeof node !== 'object') return null;
  const next = [...path, [node.type, node.key]];
  if (node.type === type) return next;
  return React.Children.toArray(node.props?.children).map(child => pathTo(child, type, next)).find(Boolean) || null;
}
test('entering and exiting selection preserves the card and swipe reconciliation paths', () => {
  const f = fixture();
  const normal = f.render({ selectionMode: false });
  const selection = f.render({ selectionMode: true, selected: true });
  const restored = f.render({ selectionMode: false });
  for (const type of ['card', 'swipe']) {
    assert.deepEqual(pathTo(normal, type), pathTo(selection, type));
    assert.deepEqual(pathTo(selection, type), pathTo(restored, type));
  }
  assert.equal(find(normal, 'touch').props.disabled, true);
  assert.equal(find(restored, 'swipe').props.enabled, true);
});

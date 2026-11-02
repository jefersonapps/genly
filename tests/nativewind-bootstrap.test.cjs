const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');

test('NativeWind bootstrap registers supported components without accessing deprecated ImageBackground', () => {
  let deprecatedReads = 0;
  const registered = [];
  const native = Object.fromEntries(['Image', 'Pressable', 'Switch', 'Text', 'TouchableHighlight', 'TouchableOpacity', 'TouchableWithoutFeedback', 'View', 'ActivityIndicator', 'StatusBar', 'ScrollView', 'TextInput', 'FlatList', 'KeyboardAvoidingView', 'VirtualizedList'].map(key => [key, key]));
  Object.defineProperty(native, 'ImageBackground', { get() { deprecatedReads++; throw new Error('deprecated getter accessed'); } });
  createSourceLoader({
    'react-native': native,
    './api': { cssInterop: component => registered.push(component), remapProps: component => registered.push(component) },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
  })('node_modules/react-native-css-interop/dist/runtime/components.js');
  assert.equal(deprecatedReads, 0);
  assert.ok(registered.includes('View'));
  assert.ok(registered.includes('Image'));
  assert.ok(registered.includes('TextInput'));
});

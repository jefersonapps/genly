const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSourceLoader } = require('./load-source.cjs');
const { hookRuntime } = require('./hook-runtime.cjs');

function find(element, predicate) {
  if (!element || typeof element !== 'object') return null;
  if (predicate(element)) return element;
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) {
    const result = find(child, predicate);
    if (result) return result;
  }
  return null;
}
function fixture(granted = true) {
  const root = hookRuntime();
  let activeRuntime = root;
  const react = {};
  for (const name of ['useEffect', 'useRef', 'useState']) react[name] = (...args) => activeRuntime.react[name](...args);
  const View = () => null, Modal = () => null, CameraView = () => null;
  const Button = Object.assign(() => null, { Text: () => null });
  const absoluteFill = { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 };
  let appChange;
  const scanned = [];
  let closed = 0, refreshes = 0;
  const refresh = async () => { refreshes++; return { granted }; };
  const load = createSourceLoader({
    react, '@/components/ui/Button': { Button },
    '@/providers/ThemeProvider': { useTheme: () => ({ resolvedTheme: 'dark', primaryColor: '#208aef' }) },
    'expo-camera': { CameraView, useCameraPermissions: () => [{ granted, canAskAgain: true }, async () => {}, refresh] },
    'lucide-react-native': { Camera: () => null, X: () => null },
    'react-native': { View, Modal, Text: () => null, TouchableOpacity: () => null, ActivityIndicator: () => null,
      Linking: { openSettings: async () => {} }, StyleSheet: { absoluteFill, create: styles => styles },
      AppState: { currentState: 'active', addEventListener: (_name, callback) => { appChange = callback; return { remove() {} }; } },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 20, left: 0 }) },
  });
  const { QrScannerModal } = load('src/components/qr/QrScannerModal.tsx');
  root.flush(() => QrScannerModal({ onClose: () => closed++, onScanned: data => scanned.push(data) }));
  const session = () => find(root.result(), element => element.type?.name === 'CameraSession');
  const show = () => {
    root.result().props.onShow();
    find(root.result(), element => element.type === View && element.props.onLayout).props.onLayout({ nativeEvent: { layout: { width: 360, height: 640 } } });
    root.flush();
  };
  return { root, session, show, scanned, CameraView, absoluteFill, closed: () => closed, refreshes: () => refreshes,
    changeApp: state => { activeRuntime = root; appChange(state); root.flush(); },
    mountSession() {
      const element = session();
      const child = hookRuntime(); activeRuntime = child;
      child.flush(() => element.type(element.props));
      return child;
    },
  };
}

test('camera waits for the accelerated modal and a nonzero native preview area', () => {
  const env = fixture();
  assert.equal(env.root.result().props.hardwareAccelerated, true);
  assert.equal(env.session(), null);
  env.show();
  assert.ok(env.session());
});
test('preview has explicit native dimensions, no children, and scanning starts after readiness', () => {
  const env = fixture(); env.show();
  const child = env.mountSession();
  let camera = find(child.result(), element => element.type === env.CameraView);
  assert.deepEqual(camera.props.style, env.absoluteFill);
  assert.equal(camera.props.facing, 'back');
  assert.equal(camera.props.children, undefined);
  camera.props.onBarcodeScanned({ data: "not-ready" });
  assert.deepEqual(env.scanned, []);
  camera.props.onCameraReady(); child.flush();
  camera = find(child.result(), element => element.type === env.CameraView);
  camera.props.onBarcodeScanned({ data: 'https://example.test' });
  camera.props.onBarcodeScanned({ data: 'https://example.test' });
  assert.deepEqual(env.scanned, ['https://example.test']);
});
test('backgrounding releases the camera and foregrounding creates a fresh session', () => {
  const env = fixture(); env.show();
  assert.ok(env.session());
  env.changeApp('background');
  assert.equal(env.session(), null);
  env.changeApp('active');
  assert.ok(env.session());
  assert.equal(env.refreshes(), 1);
});
test('denied permission never mounts a camera, and native back closes the modal', () => {
  const env = fixture(false); env.show();
  assert.equal(env.session(), null);
  env.root.result().props.onRequestClose();
  assert.equal(env.closed(), 1);
});

test('a native preview error releases the camera and retry starts a clean session', () => {
  const env = fixture(); env.show();
  const child = env.mountSession();
  const camera = find(child.result(), element => element.type === env.CameraView);
  const previous = console.debug;
  try {
    console.debug = () => {};
    camera.props.onMountError({ message: 'camera unavailable' });
  } finally { console.debug = previous; }
  child.flush();
  assert.equal(find(child.result(), element => element.type === env.CameraView), null);
  const retry = find(child.result(), element => element.props?.onPress && element.props.children?.props?.children === 'Tentar novamente');
  assert.ok(retry);
  retry.props.onPress(); child.flush();
  const restarted = find(child.result(), element => element.type === env.CameraView);
  assert.ok(restarted);
  assert.notEqual(restarted.key, camera.key);
});

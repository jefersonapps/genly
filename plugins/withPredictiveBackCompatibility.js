const { withMainActivity } = require('@expo/config-plugins');

// RN 0.88 installs its dispatcher workaround on Android 16+. Earlier releases
// still need to forward the platform callback to RN's existing back handling.
const marker = '// genly-predictive-back-compatibility';
const bridge = `
    ${marker}
    if (Build.VERSION.SDK_INT in 33..35) {
      onBackInvokedDispatcher.registerOnBackInvokedCallback(
        android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
        android.window.OnBackInvokedCallback { onBackPressed() }
      )
    }
`;
module.exports = function withPredictiveBackCompatibility(config) {
  return withMainActivity(config, config => {
    if (config.modResults.language !== 'kt') throw new Error('Predictive back compatibility requires Kotlin MainActivity.');
    const source = config.modResults.contents;
    if (source.includes(marker)) return config;
    const anchor = 'super.onCreate(null)';
    if (!source.includes(anchor)) throw new Error('Unable to locate MainActivity.onCreate for predictive back compatibility.');
    config.modResults.contents = source.replace(anchor, anchor + bridge);
    return config;
  });
};

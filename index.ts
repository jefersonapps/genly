import '@expo/metro-runtime';
import { registerRootComponent } from 'expo';
import { createElement } from 'react';
import { Platform } from 'react-native';
import {
  registerWidgetConfigurationScreen,
  registerWidgetTaskHandler,
  type WidgetConfigurationScreenProps,
} from 'react-native-android-widget';

registerWidgetTaskHandler(async (props) => {
  const { widgetTaskHandler } = require('./src/widgets/widget-task-handler');
  await widgetTaskHandler(props);
});

registerWidgetConfigurationScreen(function WidgetConfiguration(props: WidgetConfigurationScreenProps) {
  const { WidgetConfigurationScreen } = require('./src/widgets/WidgetConfigurationScreen');
  return createElement(WidgetConfigurationScreen, props);
});

if (Platform.OS === 'android') {
  // Android starts this entry for headless widget tasks too. Load the router,
  // styles and app screens only when an Activity actually renders the app.
  registerRootComponent(function MainApp() {
    const App = require('./src/App').default;
    return createElement(App);
  });
} else {
  require('expo-router/entry');
}

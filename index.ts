import 'expo-router/entry';
import './src/global.css';

import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';
import { widgetTaskHandler } from './src/widgets/widget-task-handler';
import { WidgetConfigurationScreen } from './src/widgets/WidgetConfigurationScreen';

registerWidgetTaskHandler(widgetTaskHandler);
registerWidgetConfigurationScreen(WidgetConfigurationScreen);

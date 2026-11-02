import { useEffect } from 'react';
import { LogBox, Platform, TurboModuleRegistry, type TurboModule } from 'react-native';
import { scheduleIdleTask } from '@/utils/idle';

type DevToolsSettings = TurboModule & { openDebugger?: () => void };
let requestedForRuntime = false;

if (__DEV__) {
  // Hide only the RN prompt; actual warnings and errors remain available.
  LogBox.ignoreLogs([/^Open debugger to view warnings\.$/]);
}

export function useDevelopmentTools() {
  useEffect(() => {
    if (!__DEV__ || Platform.OS === 'web' || requestedForRuntime) return;
    return scheduleIdleTask(() => {
      if (requestedForRuntime) return;
      const settings = TurboModuleRegistry.get<DevToolsSettings>('DevSettings');
      if (!settings?.openDebugger) return;
      requestedForRuntime = true;
      try {
        settings.openDebugger();
      } catch (error) {
        // A missing desktop debugger must not interrupt the app on the phone.
        requestedForRuntime = false;
        console.debug('[DevTools] Unable to open the desktop debugger.', error);
      }
    }, 2000);
  }, []);
}

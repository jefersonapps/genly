import { useAppUpdateStore } from '@/store/useAppUpdateStore';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

/** Poll only while visible. Android continues the transfer while JS is suspended. */
export function useUpdateDownloadMonitor() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let disposed = false;
    const syncTimer = () => {
      const shouldPoll = !disposed && AppState.currentState === 'active' && useAppUpdateStore.getState().isDownloading;
      if (shouldPoll && !timer) timer = setInterval(() => { void useAppUpdateStore.getState().refreshDownload(); }, 1000);
      if (!shouldPoll && timer) { clearInterval(timer); timer = undefined; }
    };
    const restore = () => {
      void useAppUpdateStore.getState().refreshDownload().then(syncTimer);
    };
    const unsubscribe = useAppUpdateStore.subscribe(syncTimer);
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') restore();
      syncTimer();
    });
    restore();
    return () => {
      disposed = true;
      unsubscribe();
      listener.remove();
      if (timer) clearInterval(timer);
    };
  }, []);
}

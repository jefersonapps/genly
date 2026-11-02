import { scheduleIdleTask } from '@/utils/idle';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

/** Show the tab before refreshing its data, and cancel work if it loses focus. */
export function useDeferredFocusEffect(effect: () => void | (() => void)) {
  useFocusEffect(useCallback(() => {
    let cleanup: void | (() => void);
    const cancel = scheduleIdleTask(() => { cleanup = effect(); });
    return () => {
      cancel();
      cleanup?.();
    };
  }, [effect]));
}

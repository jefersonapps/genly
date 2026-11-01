import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

import { navigateBackOrHome } from '@/navigation/backNavigation';

export function useBackOrHome() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const fromWidget = source === 'widget';
  const goBack = useCallback(() => {
    navigateBackOrHome(router, fromWidget);
  }, [router, fromWidget]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!fromWidget && router.canGoBack()) return false;
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [router, fromWidget, goBack]));

  return goBack;
}

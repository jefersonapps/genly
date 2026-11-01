import type { useRouter } from 'expo-router';

export const rootNavigationSettings = { anchor: '(tabs)' } as const;

type BackRouter = Pick<ReturnType<typeof useRouter>, 'back' | 'canGoBack' | 'dismissTo' | 'replace'>;

export function navigateBackOrHome(router: BackRouter, fromWidget: boolean) {
  if (fromWidget) {
    // Remove the widget destination and any intermediate screens above home.
    router.dismissTo('/(tabs)');
  } else if (router.canGoBack()) {
    router.back();
  } else {
    // Also support links rendered by widgets installed before this change.
    router.replace('/(tabs)');
  }
}

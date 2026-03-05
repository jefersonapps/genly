import { useAnimatedScrollHandler, useSharedValue, withTiming } from 'react-native-reanimated';

export interface UseHeaderSnapOptions {
  /**
   * Maximum scroll threshold where the snap occurs.
   * If scroll ends between 0 and this threshold, it snaps to either 0 or the max.
   * Typically aligns with the TabHeader's titleThreshold max value.
   * @default 50
   */
  snapThreshold?: number;
}

export function useHeaderSnap(options: UseHeaderSnapOptions = {}) {
  const { snapThreshold = 50 } = options;
  const halfThreshold = snapThreshold / 2;

  // Raw scroll position for anything that needs precise tracking
  const scrollY = useSharedValue(0);
  // Snapping scroll position specialized for the sticky header
  const headerScrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = Math.max(0, event.contentOffset.y);
      scrollY.value = y;
      headerScrollY.value = y;
    },
    onEndDrag: (event) => {
      const y = event.contentOffset.y;
      if (y > 0 && y < snapThreshold) {
        headerScrollY.value = withTiming(y >= halfThreshold ? snapThreshold : 0, { duration: 200 });
      }
    },
    onMomentumEnd: (event) => {
      const y = event.contentOffset.y;
      if (y > 0 && y < snapThreshold) {
        headerScrollY.value = withTiming(y >= halfThreshold ? snapThreshold : 0, { duration: 200 });
      }
    },
  });

  return { scrollY, headerScrollY, scrollHandler };
}

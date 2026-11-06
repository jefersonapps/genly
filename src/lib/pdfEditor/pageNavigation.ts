import { Gesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

export const INITIAL_PAGE_NAVIGATION = {
  pinching: false, pinchOwned: false, releasing: false,
  startScale: 1, anchorX: 0, anchorY: 0, panX: 0, panY: 0,
};
export type PageNavigationState = typeof INITIAL_PAGE_NAVIGATION;

interface Options {
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  navigationActive: SharedValue<boolean>;
  state: SharedValue<PageNavigationState>;
}

/** Coordinates are relative to the stationary viewport; content transforms from its top-left. */
export function createPageNavigation({ scale, translateX, translateY, navigationActive, state }: Options) {
  const pinchGesture = Gesture.Pinch()
    .onTouchesDown(event => {
      'worklet';
      navigationActive.set(event.numberOfTouches > 1);
    })
    .onTouchesUp(event => {
      'worklet';
      if (event.numberOfTouches < 2) state.set({ ...state.value, releasing: true });
      if (event.numberOfTouches === 0) navigationActive.set(false);
    })
    .onStart(event => {
      'worklet';
      navigationActive.set(true);
      state.set({ ...state.value, pinching: true, pinchOwned: true, releasing: false, startScale: scale.value,
        anchorX: (event.focalX - translateX.value) / scale.value,
        anchorY: (event.focalY - translateY.value) / scale.value });
    })
    .onUpdate(event => {
      'worklet';
      if (state.value.releasing || event.numberOfPointers < 2) return;
      const nextScale = Math.max(0.5, Math.min(5, state.value.startScale * event.scale));
      scale.set(nextScale);
      translateX.set(event.focalX - state.value.anchorX * nextScale);
      translateY.set(event.focalY - state.value.anchorY * nextScale);
    })
    .onFinalize(() => {
      'worklet';
      state.set({ ...state.value, pinching: false });
    });

  const panGesture = Gesture.Pan().minPointers(2).averageTouches(true)
    .onTouchesDown(event => {
      'worklet';
      navigationActive.set(event.numberOfTouches > 1);
    })
    .onTouchesUp(event => {
      'worklet';
      if (event.numberOfTouches < 2) state.set({ ...state.value, releasing: true });
      if (event.numberOfTouches === 0) navigationActive.set(false);
    })
    .onStart(event => {
      'worklet';
      navigationActive.set(true);
      state.set({ ...state.value, pinchOwned: state.value.pinching, releasing: false,
        panX: event.translationX, panY: event.translationY });
    })
    .onUpdate(event => {
      'worklet';
      // Keep pinch ownership until the next gesture. Pinch can finalize before
      // pan when one finger lifts; its remaining pan events must not move the page.
      if (!state.value.pinchOwned && !state.value.releasing && event.numberOfPointers >= 2) {
        translateX.set(translateX.value + event.translationX - state.value.panX);
        translateY.set(translateY.value + event.translationY - state.value.panY);
      }
      state.set({ ...state.value, panX: event.translationX, panY: event.translationY });
    });
  return { pinchGesture, panGesture };
}

import { Gesture, type GestureType, type GestureUpdateEvent, type PanGestureHandlerEventPayload } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

type PanEvent = GestureUpdateEvent<PanGestureHandlerEventPayload>;
export type PointerStates = Record<string, { active: boolean; cancelled: boolean }>;

interface Options {
  id: string;
  state: SharedValue<PointerStates>;
  navigationGestures: GestureType[];
  navigationActive?: SharedValue<boolean>;
  onStart: (event: PanEvent) => void;
  onUpdate: (event: PanEvent) => void;
  onEnd: (event: PanEvent) => void;
  onCancel: () => void;
}

/** Object edits yield to page navigation as soon as another finger is added. */
export function singlePointerPan({ id, state, navigationGestures, navigationActive, onStart, onUpdate, onEnd, onCancel }: Options) {
  const cancel = () => {
    'worklet';
    if (state.value[id]?.active) onCancel();
    state.set({ ...state.value, [id]: { active: false, cancelled: true } });
  };
  return Gesture.Pan().minDistance(2).maxPointers(1)
    .simultaneousWithExternalGesture(...navigationGestures)
    .onBegin(() => {
      'worklet';
      state.set({ ...state.value, [id]: { active: false, cancelled: navigationActive?.value || false } });
    })
    .onTouchesDown((event, manager) => {
      'worklet';
      if (event.numberOfTouches > 1) { cancel(); manager.fail(); }
    })
    .onStart(event => {
      'worklet';
      if (navigationActive?.value || event.numberOfPointers > 1 || state.value[id]?.cancelled) { cancel(); return; }
      state.set({ ...state.value, [id]: { active: true, cancelled: false } });
      onStart(event);
    })
    .onUpdate(event => {
      'worklet';
      if (navigationActive?.value || event.numberOfPointers > 1) { cancel(); return; }
      if (state.value[id]?.active && !state.value[id]?.cancelled) onUpdate(event);
    })
    .onEnd((event, success) => {
      'worklet';
      if (!success || navigationActive?.value || event.numberOfPointers > 1 || state.value[id]?.cancelled) { cancel(); return; }
      if (state.value[id]?.active) onEnd(event);
      state.set({ ...state.value, [id]: { active: false, cancelled: false } });
    })
    .onFinalize((_event, success) => {
      'worklet';
      if (!success) cancel();
    });
}

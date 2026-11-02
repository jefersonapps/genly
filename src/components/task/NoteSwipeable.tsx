import React, { useCallback, useImperativeHandle, useLayoutEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export interface NoteSwipeableMethods {
  close: () => void;
  reset: () => void;
}
interface Props {
  ref?: React.Ref<NoteSwipeableMethods>;
  children: React.ReactNode;
  actions: React.ReactNode;
  onSwipeStart: () => void;
  backgroundColor: string;
  enabled?: boolean;
}
const ACTION_WIDTH = 148;
const SPRING = { damping: 28, stiffness: 320, mass: 0.8, overshootClamping: true };

export function NoteSwipeable({ ref, children, actions, onSwipeStart, backgroundColor, enabled = true }: Props) {
  const offset = useSharedValue(0);
  const start = useSharedValue(0);
  const settled = useSharedValue(0);
  const close = useCallback(() => {
    settled.value = 0;
    offset.value = withSpring(0, SPRING);
  }, [offset, settled]);
  const reset = useCallback(() => {
    cancelAnimation(offset);
    offset.value = 0;
    start.value = 0;
    settled.value = 0;
  }, [offset, start, settled]);
  useImperativeHandle(ref, () => ({ close, reset }), [close, reset]);
  useLayoutEffect(() => {
    if (!enabled) reset();
  }, [enabled, reset]);

  const pan = useMemo(() => Gesture.Pan()
    .enabled(enabled)
    // Vertical intent must fail early so the parent list can scroll freely.
    .activeOffsetX([-24, 24])
    .failOffsetY([-8, 8])
    .maxPointers(1)
    .onStart(() => {
      cancelAnimation(offset);
      start.value = offset.value;
      scheduleOnRN(onSwipeStart);
    })
    .onUpdate(event => {
      offset.value = Math.max(-ACTION_WIDTH, Math.min(0, start.value + event.translationX));
    })
    .onEnd(event => {
      const projected = offset.value + event.velocityX * 0.12;
      settled.value = projected < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0;
      offset.value = withSpring(settled.value, SPRING);
    })
    .onFinalize((_event, success) => {
      if (!success && offset.value !== settled.value) offset.value = withSpring(settled.value, SPRING);
    }), [enabled, offset, start, settled, onSwipeStart]);

  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-offset.value, [0, 24, ACTION_WIDTH], [0, 0.15, 1], 'clamp'),
    transform: [{ translateX: (ACTION_WIDTH + offset.value) * 0.2 }],
    pointerEvents: offset.value < -24 ? 'auto' : 'none',
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.actions, actionsStyle]}>{actions}</Animated.View>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View style={[styles.content, { backgroundColor }, contentStyle]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { borderRadius: 16, overflow: 'hidden' },
  content: { borderRadius: 16 },
  actions: { position: 'absolute', top: 0, right: 0, bottom: 0, width: ACTION_WIDTH },
});

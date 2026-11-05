import React from 'react';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

interface Props {
  gesture: GestureType;
  canvasScale: SharedValue<number>;
  boxWidth: SharedValue<number>;
  boxHeight: SharedValue<number>;
  horizontal: 'left' | 'center' | 'right';
  vertical: 'top' | 'center' | 'bottom';
  kind: 'corner' | 'edge' | 'crop';
  color: string;
}

/** Keep both the visible grip and its touch target independent of page zoom. */
export function PdfSelectionHandle({ gesture, canvasScale, boxWidth, boxHeight, horizontal, vertical, kind, color }: Props) {
  const targetStyle = useAnimatedStyle(() => {
    const x = horizontal === 'left' ? 0 : horizontal === 'right' ? boxWidth.value : boxWidth.value / 2;
    const y = vertical === 'top' ? 0 : vertical === 'bottom' ? boxHeight.value : boxHeight.value / 2;
    return {
      // Keep layout dimensions fixed: Yoga's pixel rounding of 36 / zoom can
      // otherwise move the grip away from its anchor when the page is magnified.
      transform: [{ translateX: x - 18 }, { translateY: y - 18 }, { scale: 1 / canvasScale.value }],
    };
  });
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: 36, height: 36,
        zIndex: 60, alignItems: 'center', justifyContent: 'center' }, targetStyle]}>
        <Animated.View pointerEvents="none" style={{ backgroundColor: '#FFFFFF', borderColor: color,
          width: kind === 'corner' ? 16 : 12, height: kind === 'corner' ? 16 : 12,
          borderRadius: kind === 'corner' ? 8 : 2, borderWidth: kind === 'corner' ? 1.5 : 1,
          borderStyle: kind === 'edge' ? 'dashed' : 'solid' }} />
      </Animated.View>
    </GestureDetector>
  );
}

import { useTheme } from "@/providers/ThemeProvider";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import React, { useCallback } from "react";
import {
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  accentColor?: string;
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  accentColor,
}: RangeControlProps) {
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === "dark";
  const activeColor = accentColor || primaryColor;

  const trackWidth = useSharedValue(0);
  const isInteracting = useSharedValue(false);

  const colors = {
    text: isDark ? "#A1A1AA" : "#71717A",
    valueText: isDark ? "#FAFAFA" : "#18181B",
    track: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
    buttonBg: isDark ? "#262626" : "#E4E4E7",
  };

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  const updateValue = useCallback((x: number) => {
    const percentage = Math.max(0, Math.min(1, x / trackWidth.value));
    const rawValue = min + percentage * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    const finalValue = Number(Math.max(min, Math.min(max, steppedValue)).toFixed(2));
    
    if (finalValue !== value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(finalValue);
    }
  }, [min, max, step, value, onChange]);

  const gesture = Gesture.Pan()
    .onStart((e) => {
      isInteracting.value = true;
      runOnJS(updateValue)(e.x);
    })
    .onUpdate((e) => {
      runOnJS(updateValue)(e.x);
    })
    .onEnd(() => {
      isInteracting.value = false;
    });

  const tapGesture = Gesture.Tap()
    .onStart((e) => {
      runOnJS(updateValue)(e.x);
    });

  const animatedFillStyle = useAnimatedStyle(() => {
    const percentage = (value - min) / (max - min);
    return {
      width: `${percentage * 100}%`,
      backgroundColor: activeColor,
    };
  });

  const animatedThumbStyle = useAnimatedStyle(() => {
    const percentage = (value - min) / (max - min);
    return {
      left: `${percentage * 100}%`,
      transform: [
        { translateX: -10 },
        { scale: isInteracting.value ? 1.2 : 1 }
      ],
      backgroundColor: "#FFF",
      borderColor: activeColor,
    };
  });

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    if (newValue !== value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(Number(newValue.toFixed(2)));
    }
  };

  const handleIncrement = () => {
    const newValue = Math.min(max, value + step);
    if (newValue !== value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(Number(newValue.toFixed(2)));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.valueText }]}>{value}</Text>
      </View>

      <View style={styles.controlRow}>
        <TouchableOpacity 
          onPress={handleDecrement}
          style={[styles.adjustBtn, { backgroundColor: colors.buttonBg }]}
          activeOpacity={0.7}
        >
          <Minus size={18} color={colors.valueText} />
        </TouchableOpacity>

        <GestureDetector gesture={Gesture.Exclusive(gesture, tapGesture)}>
          <View style={styles.trackContainer} onLayout={onLayout}>
            <View style={[styles.track, { backgroundColor: colors.track }]}>
              <Animated.View style={[styles.fill, animatedFillStyle]} />
            </View>
            <Animated.View style={[styles.thumb, animatedThumbStyle]} />
          </View>
        </GestureDetector>

        <TouchableOpacity 
          onPress={handleIncrement}
          style={[styles.adjustBtn, { backgroundColor: colors.buttonBg }]}
          activeOpacity={0.7}
        >
          <Plus size={18} color={colors.valueText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adjustBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    top: 10, // Center on the 40px container (40/2 - 20/2)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
});

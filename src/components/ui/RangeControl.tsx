import { useTheme } from "@/providers/ThemeProvider";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import React, { useCallback } from "react";
import {
  LayoutChangeEvent,
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
    <View className="mb-4 w-full">
      <View className="flex-row justify-between items-center mb-2 px-1">
        <Text className="text-[13px] font-sans-bold uppercase tracking-widest" style={{ color: colors.text }}>{label}</Text>
        <Text className="text-sm font-sans-bold font-mono" style={{ color: colors.valueText }}>{value}</Text>
      </View>

      <View className="flex-row items-center gap-3">
        <TouchableOpacity 
          onPress={handleDecrement}
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={[{ backgroundColor: colors.buttonBg }]}
          activeOpacity={0.8}
        >
          <Minus size={18} color={colors.valueText} />
        </TouchableOpacity>
 
        <GestureDetector gesture={Gesture.Exclusive(gesture, tapGesture)}>
          <View className="flex-1 h-10 justify-center relative" onLayout={onLayout}>
            <View className="h-1.5 rounded-full w-full overflow-hidden" style={[{ backgroundColor: colors.track }]}>
              <Animated.View style={[{ height: '100%' }, animatedFillStyle]} />
            </View>
            <Animated.View 
              className="absolute w-5 h-5 rounded-full border-[3px] shadow elevation-2"
              style={[
                { top: 10 },
                animatedThumbStyle
              ]} 
            />
          </View>
        </GestureDetector>

        <TouchableOpacity 
          onPress={handleIncrement}
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={[{ backgroundColor: colors.buttonBg }]}
          activeOpacity={0.8}
        >
          <Plus size={18} color={colors.valueText} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

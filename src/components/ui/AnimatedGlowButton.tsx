import { adjustColor } from '@/utils/colors';
import { BlurMask, Canvas, Circle, RadialGradient, vec } from "@shopify/react-native-skia";
import React, { useEffect } from 'react';
import { StyleProp, TouchableOpacity, View, ViewStyle } from 'react-native';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';

interface AnimatedGlowButtonProps {
  onPress: () => void;
  color: string;
  icon: React.ReactNode;
  size?: number;
  glowSize?: number;
  style?: StyleProp<ViewStyle>;
}

export const AnimatedGlowButton: React.FC<AnimatedGlowButtonProps> = ({
  onPress,
  color,
  icon,
  size = 48,
  glowSize = 70,
  style
}) => {
  // Animation Values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    // Breathing/Pulse Animation
    scale.value = withRepeat(
      withTiming(1.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    opacity.value = withRepeat(
      withTiming(0.8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  // Derived values for Skia
  const radius = glowSize / 2;
  const center = vec(radius, radius);

  // Let's try animating the Canvas container opacity/scale for the "Outer" glow.
  const rStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center', width: size, height: size }, style]}>
      {/* Animated Glow Layer */}
      <Animated.View 
        pointerEvents="none"
        style={[
          { 
            position: 'absolute',
            width: glowSize, 
            height: glowSize,
            // Center the glow relative to the smaller container
            top: (size - glowSize) / 2,
            left: (size - glowSize) / 2,
            alignItems: 'center', 
            justifyContent: 'center' 
          }, 
          rStyle
        ]}
      >
        <Canvas style={{ width: glowSize, height: glowSize }}>
          <Circle c={center} r={radius}>
            <RadialGradient
              c={center}
              r={radius}
              colors={[adjustColor(color, 40) + 'AA', adjustColor(color, 20) + '00']} // Lighter color -> Transparent
            />
            <BlurMask blur={15} style="normal" />
          </Circle>
        </Canvas>
      </Animated.View>

      {/* Button */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: adjustColor(color, -20),
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        {icon}
      </TouchableOpacity>
    </View>
  );
};

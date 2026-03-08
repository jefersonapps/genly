import { useTheme } from '@/providers/ThemeProvider';
import React from 'react';
import { View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabHeaderProps {
  scrollY: SharedValue<number>;
  title: string;
  titleThreshold?: [number, number];
  backgroundThreshold?: [number, number];
  secondaryTitle?: string;
  secondaryTitleThreshold?: [number, number];
  leftComponent?: React.ReactNode;
  rightComponent?: React.ReactNode;
  hasSlideIn?: boolean;
  /** Optional content rendered below the header row (inside the absolute container) */
  bottomContent?: React.ReactNode;
  /** When provided, drives title swap snap — 1 = force secondary title visible */
  stickyProgress?: SharedValue<number>;
}

export const TabHeader: React.FC<TabHeaderProps> = ({
  scrollY,
  title,
  titleThreshold = [40, 60],
  backgroundThreshold = [0, 15],
  secondaryTitle,
  secondaryTitleThreshold = [420, 480],
  leftComponent,
  rightComponent,
  hasSlideIn = false,
  bottomContent,
  stickyProgress,
}) => {
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Solid background color — no rgba interpolation needed
  const bgColor = isDark ? '#121212' : '#ffffff';
  const borderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';

  // Background layer: only animates numeric `opacity` — 100% worklet-safe
  const bgLayerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      backgroundThreshold,
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // Container anim: only translateY for slide-in, no color/shadow props
  const containerAnimStyle = useAnimatedStyle(() => {
    if (!hasSlideIn) return {};
    
    const opacity = interpolate(
      scrollY.value,
      backgroundThreshold,
      [0, 1],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      backgroundThreshold,
      [-100, 0],
      Extrapolation.CLAMP
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const headerTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      titleThreshold,
      [0, 1],
      Extrapolation.CLAMP
    );

    // If we have a secondary title, fade primary out as secondary comes in
    let fadeOut = 1;
    if (secondaryTitle) {
      // When stickyProgress snaps to 1, force primary title hidden
      const stickyP = stickyProgress ? stickyProgress.value : 0;
      const scrollFadeOut = interpolate(
        scrollY.value,
        [secondaryTitleThreshold[0] - 60, secondaryTitleThreshold[0]],
        [1, 0],
        Extrapolation.CLAMP
      );
      // Use the minimum — either scroll drove it to 0, or sticky snap did
      fadeOut = Math.min(scrollFadeOut, 1 - stickyP);
    }

    return { opacity: opacity * fadeOut };
  });

  const sectionHeaderTitleStyle = useAnimatedStyle(() => {
    if (!secondaryTitle) return { opacity: 0 };
    
    const scrollOpacity = interpolate(
      scrollY.value,
      secondaryTitleThreshold,
      [0, 1],
      Extrapolation.CLAMP
    );
    // When stickyProgress snaps to 1, force secondary title fully visible
    const stickyP = stickyProgress ? stickyProgress.value : 0;
    const opacity = Math.max(scrollOpacity, stickyP);
    return { opacity };
  });

  return (
    <View className="absolute top-0 left-0 right-0 z-50" pointerEvents="box-none">
      <Animated.View
        className="pb-2 px-6"
        style={[
          { paddingTop: insets.top + 4 },
          containerAnimStyle,
        ]}
        pointerEvents="auto"
      >
        {/* Background layer — solid color, numeric opacity only (no rgba strings) */}
        <Animated.View
          className="absolute inset-0 border-b"
          style={[
            {
              backgroundColor: bgColor,
              borderBottomColor: borderColor,
            },
            bgLayerStyle,
          ]}
          pointerEvents="none"
        />

        <View className="flex-row items-center justify-between h-12">
          <View className="flex-row items-center gap-3 flex-1">
            {leftComponent}
            <View className="relative h-7 justify-center flex-1">
              <Animated.Text 
                className="absolute font-sans-bold text-lg text-on-surface"
                style={headerTitleStyle}
                numberOfLines={1}
              >
                {title}
              </Animated.Text>
              {secondaryTitle && (
                <Animated.Text 
                  className="absolute font-sans-bold text-lg text-on-surface"
                  style={sectionHeaderTitleStyle}
                  numberOfLines={1}
                >
                  {secondaryTitle}
                </Animated.Text>
              )}
            </View>
          </View>
          
          <View className="flex-row gap-3 ml-auto">
            {rightComponent}
          </View>
        </View>

        {/* Optional content below header (e.g. sticky group chips) */}
        {bottomContent}
      </Animated.View>
    </View>
  );
};

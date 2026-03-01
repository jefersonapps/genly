import { useTheme } from '@/providers/ThemeProvider';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle
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
}) => {
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const headerBarStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      backgroundThreshold,
      [0, 1],
      Extrapolation.CLAMP
    );

    const translateY = hasSlideIn 
      ? interpolate(scrollY.value, backgroundThreshold, [-100, 0], Extrapolation.CLAMP)
      : 0;

    return {
      backgroundColor: isDark 
        ? `rgba(18, 18, 18, ${opacity})` 
        : `rgba(255, 255, 255, ${opacity})`,
      borderBottomColor: isDark 
        ? `rgba(255, 255, 255, ${opacity * 0.1})` 
        : `rgba(0, 0, 0, ${opacity * 0.05})`,
      shadowOpacity: opacity * 0.1,
      transform: [{ translateY }],
      opacity: hasSlideIn ? opacity : 1,
    };
  });

  const headerTitleStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      titleThreshold,
      [0, 1],
      Extrapolation.CLAMP
    );

    // If we have a secondary title, we might need to fade this one out
    let fadeOut = 1;
    if (secondaryTitle) {
      fadeOut = interpolate(
        scrollY.value,
        [secondaryTitleThreshold[0] - 60, secondaryTitleThreshold[0]],
        [1, 0],
        Extrapolation.CLAMP
      );
    }

    return { opacity: opacity * fadeOut };
  });

  const sectionHeaderTitleStyle = useAnimatedStyle(() => {
    if (!secondaryTitle) return { opacity: 0 };
    
    const opacity = interpolate(
      scrollY.value,
      secondaryTitleThreshold,
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.headerBar,
          { 
            paddingTop: insets.top + 4,
          },
          headerBarStyle
        ]}
      >
        <View style={styles.content}>
          <View style={styles.leftSection}>
            {leftComponent}
            <View style={styles.titleContainer}>
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
          
          <View style={styles.rightSection}>
            {rightComponent}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  headerBar: {
    paddingBottom: 8,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  titleContainer: {
    position: 'relative',
    height: 28,
    justifyContent: 'center',
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 'auto',
  },
});

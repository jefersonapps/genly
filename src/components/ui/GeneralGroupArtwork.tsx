import { useTheme } from '@/providers/ThemeProvider';
import { withOpacity } from '@/utils/colors';
import { FileText } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { CardGradient } from './CardGradient';

/** Staggered sheets settle once on the UI thread, without a looping background animation. */
export function GeneralGroupArtwork() {
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const reducedMotion = useReducedMotion();
  const back = useSharedValue(reducedMotion ? 1 : 0);
  const middle = useSharedValue(reducedMotion ? 1 : 0);
  const front = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    const spring = { damping: 18, stiffness: 95, mass: 1.1 };
    back.value = reducedMotion ? 1 : withDelay(100, withSpring(1, spring));
    middle.value = reducedMotion ? 1 : withDelay(190, withSpring(1, spring));
    front.value = reducedMotion ? 1 : withDelay(280, withSpring(1, spring));
    return () => {
      cancelAnimation(back);
      cancelAnimation(middle);
      cancelAnimation(front);
    };
  }, [back, middle, front, reducedMotion]);

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -22 * back.value }, { translateY: 10 * back.value }, { rotate: `${-13 * back.value}deg` }],
  }));
  const middleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 20 * middle.value }, { translateY: 5 * middle.value }, { rotate: `${10 * middle.value}deg` }],
  }));
  const frontStyle = useAnimatedStyle(() => ({
    opacity: 0.6 + front.value * 0.4,
    transform: [{ translateY: 12 - 18 * front.value }, { rotate: `${-2 * front.value}deg` }, { scale: 0.94 + 0.06 * front.value }],
  }));
  const lineColor = withOpacity(primaryColor, isDark ? 0.35 : 0.24);

  return (
    <View accessible={false} pointerEvents="none" style={styles.artwork}>
      <Animated.View style={[styles.sheet, styles.back, { backgroundColor: isDark ? '#24262E' : '#DEE3EB', borderColor: withOpacity(primaryColor, 0.18) }, backStyle]} />
      <Animated.View style={[styles.sheet, styles.back, { backgroundColor: isDark ? '#303A49' : '#CFDDEE', borderColor: withOpacity(primaryColor, 0.26) }, middleStyle]} />
      <Animated.View style={[styles.sheet, styles.front, { backgroundColor: isDark ? '#1D2736' : '#F8FAFF', borderColor: withOpacity(primaryColor, 0.45) }, frontStyle]}>
        <CardGradient color={primaryColor} style={StyleSheet.absoluteFill} />
        <View style={[styles.icon, { backgroundColor: withOpacity(primaryColor, isDark ? 0.16 : 0.1) }]}>
          <FileText size={25} color={primaryColor} strokeWidth={1.7} />
        </View>
        <View style={[styles.line, { backgroundColor: lineColor, width: '82%' }]} />
        <View style={[styles.line, { backgroundColor: lineColor, width: '66%' }]} />
        <View style={[styles.line, { backgroundColor: lineColor, width: '48%' }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: { height: 160, alignItems: 'center', justifyContent: 'center' },
  sheet: { position: 'absolute', borderRadius: 18, borderWidth: 1 },
  back: { width: 98, height: 130 },
  front: { width: 108, height: 140, padding: 16, overflow: 'hidden' },
  icon: { width: 37, height: 37, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  line: { height: 4, borderRadius: 2, marginBottom: 9 },
});

import { adjustColor, adjustHue } from "@/utils/colors";
import React, { useMemo } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

interface CardGradientProps {
  color?: string;
  colors?: string[]; // Allow passing specific colors for multi-color gradients
  style?: StyleProp<ViewStyle>;
  className?: string; // For NativeWind
  hasSolidBackground?: boolean;
}

export const CardGradient = ({ color, colors: providedColors, style, className, hasSolidBackground }: CardGradientProps) => {
  const gradientColors = useMemo(() => {
    if (providedColors && providedColors.length >= 2) {
      return providedColors;
    }

    const baseColor = color || '#4f46e5'; 

    // For better contrast with white text, we generate a richer, darker gradient
    // If the color is a light/medium green like #10B981, we darken it significantly for the end point to provide depth and high contrast.
    return [
      adjustHue(adjustColor(baseColor, -15), 5), // Slightly darker, slightly shifted hue
      adjustHue(adjustColor(baseColor, -45), 15) // Much darker for high contrast and depth
    ];
  }, [color, providedColors]);

  return (
    <View style={[{ flex: 1, overflow: 'hidden' }, style]} className={className}>
      <Svg height="100%" width="100%" style={{ position: 'absolute', top: 0, left: 0 }}>
        <Defs>
          <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            {/* If it doesn't have a solid background (e.g. library cards), use transparency to mimic the old blurred circles */}
            <Stop offset="0" stopColor={gradientColors[0]} stopOpacity={hasSolidBackground ? "1" : "0.5"} />
            <Stop offset="1" stopColor={gradientColors[1]} stopOpacity={hasSolidBackground ? "1" : "0.1"} />
          </LinearGradient>
        </Defs>
        {/* Fill a solid background color first ONLY if hasSolidBackground is true */}
        {hasSolidBackground && (
            <Rect x="0" y="0" width="100%" height="100%" fill={gradientColors[0]} />
        )}
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
      </Svg>
    </View>
  );
};

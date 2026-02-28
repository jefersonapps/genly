import { adjustColor, adjustHue } from "@/utils/colors"; // Assuming this exists based on previous file usage
import { BlurMask, Canvas, Circle } from "@shopify/react-native-skia";
import React, { useMemo } from "react";
import { StyleProp, ViewStyle } from "react-native";

interface CardGradientProps {
  color?: string;
  colors?: string[]; // Allow passing specific colors for multi-color gradients
  style?: StyleProp<ViewStyle>;
  className?: string; // For NativeWind
}

export const CardGradient = ({ color, colors: providedColors, style, className }: CardGradientProps) => {
  // Generate variations of the base color or use provided colors
  const gradientColors = useMemo(() => {
    if (providedColors && providedColors.length >= 3) {
      return {
        c1: providedColors[0], // Base (Purple) - Top Left
        c2: providedColors[1], // Green - Top Right
        c3: providedColors[0], // Base (Purple) - Bottom Left
        c4: providedColors[2], // Orange - Bottom Right
        c5: providedColors[1], // Green - Center (Pop)
      };
    }

    const baseColor = color || '#4f46e5'; // Fallback

    // Dynamic variations with Hue shifts for richness
    return {
      c1: baseColor, // Base
      c2: adjustHue(adjustColor(baseColor, 40), 30), // Lighter & Hue Shift +30
      c3: adjustHue(adjustColor(baseColor, -30), -20), // Darker & Hue Shift -20
      c4: adjustHue(baseColor, 15), // Slight Hue Shift
      c5: adjustHue(adjustColor(baseColor, -20), -10), // Darker Accent
    };
  }, [color, providedColors]);

  return (
    <Canvas style={[{ flex: 1 }, style]} className={className}>
      {/* Top Left - Base/C1 */}
      <Circle cx={0} cy={0} r={140} color={gradientColors.c1} opacity={0.3}>
        <BlurMask blur={70} style="normal" />
      </Circle>

      {/* Top Right - Highlight/C2 */}
      <Circle cx={280} cy={0} r={140} color={gradientColors.c2} opacity={0.5}>
        <BlurMask blur={60} style="normal" />
      </Circle>

      {/* Bottom Left - Shadow/C3 */}
      <Circle cx={0} cy={300} r={130} color={gradientColors.c3} opacity={0.25}>
        <BlurMask blur={65} style="normal" />
      </Circle>
      
      {/* Bottom Right - Accent/C4 */}
      <Circle cx={280} cy={300} r={150} color={gradientColors.c4} opacity={0.4}>
        <BlurMask blur={70} style="normal" />
      </Circle>
      
      {/* Center/Random - Extra/C5 */}
       <Circle cx={140} cy={140} r={120} color={gradientColors.c5} opacity={0.4}>
        <BlurMask blur={50} style="normal" />
      </Circle>
    </Canvas>
  );
};

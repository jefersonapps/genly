import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

interface TransparencyGridProps extends ViewProps {
  size?: number;
  opacity?: number;
}

/**
 * A reusable checkerboard background component to visualize transparency.
 * Standard grid pattern seen in image editors like Photoshop.
 */
export function TransparencyGrid({ size = 16, opacity = 0.4, style, ...props }: TransparencyGridProps) {
  return (
    <View style={[styles.container, style]} {...props}>
      <Svg width="100%" height="100%" style={{ opacity }}>
        <Defs>
          <Pattern
            id="checker"
            x="0"
            y="0"
            width={size}
            height={size}
            patternUnits="userSpaceOnUse"
          >
            {/* Base white background is provided by the View if needed, 
                but we draw both sets of squares for consistency */}
            <Rect x="0" y="0" width={size / 2} height={size / 2} fill="#FFFFFF" />
            <Rect x={size / 2} y={size / 2} width={size / 2} height={size / 2} fill="#FFFFFF" />
            <Rect x={size / 2} y="0" width={size / 2} height={size / 2} fill="#F3F4F6" />
            <Rect x="0" y={size / 2} width={size / 2} height={size / 2} fill="#F3F4F6" />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#checker)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
});

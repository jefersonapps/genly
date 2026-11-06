import { getNodeTextColor, hexLuminance } from './nodeColors';
import React from 'react';
import { Platform, TextInput } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { MindMapNode } from './useMindMapStore';
import { NODE_TEXT_FONT, NODE_TEXT_SIZE, NODE_TEXT_LINE_HEIGHT, NODE_TEXT_PADDING } from './textLayout';

// ─── Inline Editor Component ──────────────────────────
export const InlineNodeEditor = React.memo(function InlineNodeEditor({
  node, text, onTextChange, onSave, transform, isDark, canvasBgColor
}: { 
  node: MindMapNode; 
  text: string; 
  onTextChange: (t: string) => void; 
  onSave: () => void; 
  transform: { scale: SharedValue<number>; translateX: SharedValue<number>; translateY: SharedValue<number> };
  isDark: boolean;
  canvasBgColor?: string | null;
}) {
  const background = canvasBgColor || (isDark ? '#09090B' : '#FAFAFA');
  const textColor = getNodeTextColor(node.depth, hexLuminance(background) < 0.5, node.color);

  const animatedStyle = useAnimatedStyle(() => {
    const s = transform.scale.value;
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      width: node.width,
      height: node.height,
      transformOrigin: 'left top',
      transform: [
        { translateX: transform.translateX.value + node.x * s },
        { translateY: transform.translateY.value + node.y * s },
        { scale: s },
      ],
      zIndex: 9999,
      justifyContent: 'center',
    };
  }, Platform.OS === 'web' ? [node, transform] : undefined);

  const imageSpace = node.imageUri && node.imageAspectRatio
    ? (node.width - NODE_TEXT_PADDING * 2) / node.imageAspectRatio + 16 : 0;

  return (
    <Animated.View style={animatedStyle} pointerEvents="auto">
      <TextInput
        value={text}
        onChangeText={onTextChange}
        autoFocus
        multiline
        allowFontScaling={false}
        scrollEnabled={false}
        textBreakStrategy="simple"
        lineBreakStrategyIOS="none"
        underlineColorAndroid="transparent"
        onBlur={onSave}
        placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
        style={[
          {
            color: textColor,
            fontFamily: NODE_TEXT_FONT,
            fontSize: NODE_TEXT_SIZE,
            lineHeight: NODE_TEXT_LINE_HEIGHT,
            letterSpacing: 0,
            width: '100%',
            paddingHorizontal: NODE_TEXT_PADDING,
            marginBottom: imageSpace,
            textAlign: node.textAlign || 'center',
            backgroundColor: 'transparent',
            paddingVertical: 0,
            marginHorizontal: 0,
            marginTop: 0,
            includeFontPadding: false,
          }
        ]}
      />
    </Animated.View>
  );
});


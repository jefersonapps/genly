import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import { anchorInDropdownWindow, dropdownLayout, type DropdownRect } from "@/utils/dropdownLayout";
import type { LucideIcon } from "lucide-react-native";
import React, { createContext, forwardRef, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, Text as RNText, ScrollView, TouchableOpacity, View, useWindowDimensions, type GestureResponderEvent, type LayoutRectangle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

type NativeView = React.ComponentRef<typeof View>;
interface DropdownContextType {
  close: () => void;
  layout: LayoutRectangle | null;
  setLayout: (layout: LayoutRectangle) => void;
  triggerRef: React.RefObject<NativeView | null>;
}
const DropdownContext = createContext<DropdownContextType | null>(null);
interface TriggerProps { children: React.ReactElement; asChild?: boolean }

const Trigger = forwardRef<NativeView, TriggerProps>(({ children }, ref) => {
  const context = useContext(DropdownContext);
  const child = children as React.ReactElement<{ onPress?: (event: GestureResponderEvent) => void; ref?: React.Ref<NativeView> }>;
  const assignRef = (node: NativeView | null) => {
    if (context) context.triggerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };
  return React.cloneElement(child, {
    ref: assignRef,
    onPress: event => {
      context?.triggerRef.current?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) context.setLayout({ x, y, width, height });
      });
      child.props.onPress?.(event);
    },
  });
});
interface ContentProps {
  children: React.ReactNode;
  width?: number;
  maxHeight?: number;
  align?: 'start' | 'end' | 'center';
  direction?: 'top' | 'bottom';
}
function Content(props: ContentProps) {
  const context = useContext(DropdownContext);
  if (!context?.layout) return null;
  return (
    <Modal transparent visible onRequestClose={context.close} animationType="none" statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
        <MenuViewport {...props} context={context} />
      </SafeAreaProvider>
    </Modal>
  );
}

function MenuViewport({ children, context, width = 200, maxHeight = 320, align = 'start', direction = 'bottom' }: ContentProps & { context: DropdownContextType }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const viewportRef = useRef<NativeView>(null);
  const [geometry, setGeometry] = useState<{ anchor: DropdownRect; viewport: { width: number; height: number } } | null>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>();
  const opacity = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const measure = useCallback(() => {
    viewportRef.current?.measureInWindow((originX, originY, viewportWidth, viewportHeight) => {
      context.triggerRef.current?.measureInWindow((x, y, triggerWidth, triggerHeight) => {
        if (viewportWidth <= 0 || viewportHeight <= 0 || triggerWidth <= 0 || triggerHeight <= 0) return;
        setGeometry({
          anchor: anchorInDropdownWindow({ x, y, width: triggerWidth, height: triggerHeight }, { x: originX, y: originY }),
          viewport: { width: viewportWidth, height: viewportHeight },
        });
      });
    });
  }, [context.triggerRef]);

  // Popup resizing and rotation can change both the viewport and trigger position.
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [measure, dimensions.width, dimensions.height]);
  const ready = geometry !== null && contentHeight !== undefined;
  useLayoutEffect(() => {
    if (ready) opacity.value = withTiming(1, { duration: 120 });
  }, [ready, opacity]);

  const position = geometry ? dropdownLayout({
    ...geometry, insets, width, contentHeight: contentHeight === undefined ? undefined : contentHeight + 2,
    maxHeight, align, direction,
  }) : null;

  return (
    <View ref={viewportRef} collapsable={false} style={{ flex: 1 }} onLayout={measure}>
      <Pressable onPress={context.close} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} accessibilityLabel="Fechar menu" />
      {position && (
        <Animated.View
          accessibilityViewIsModal
          className="absolute rounded-xl border overflow-hidden"
          style={[{ left: position.left, top: position.top, width: position.width, height: position.height,
            backgroundColor: isDark ? '#18181B' : '#FFFFFF', borderColor: isDark ? '#27272A' : '#E4E4E7' }, shadows.lg, animatedStyle]}
        >
          <ScrollView
            style={{ height: Math.max(1, position.height - 2) }}
            contentContainerStyle={{ padding: 6 }}
            onContentSizeChange={(_width, height) => setContentHeight(height)}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            indicatorStyle={isDark ? 'white' : 'black'}
          >
            {children}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

interface ItemProps { icon?: LucideIcon; label: string; onPress: () => void; destructive?: boolean }
function Item({ icon: Icon, label, onPress, destructive }: ItemProps) {
  const context = useContext(DropdownContext);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const textColor = destructive ? '#EF4444' : isDark ? '#E4E4E7' : '#3F3F46';
  return (
    <TouchableOpacity
      onPress={() => { context?.close(); requestAnimationFrame(onPress); }}
      accessibilityRole="menuitem"
      activeOpacity={0.8}
      className="flex-row items-center gap-2.5 py-2.5 px-2.5 rounded-lg mb-0.5"
      style={{ minHeight: 44, ...(destructive ? { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2' } : {}) }}
    >
      {Icon && <Icon size={18} color={textColor} />}
      <RNText className="text-sm font-sans-semibold" style={{ color: textColor, flexShrink: 1 }}>{label}</RNText>
    </TouchableOpacity>
  );
}
interface DropdownProps { children: React.ReactNode }
function DropdownRoot({ children }: DropdownProps) {
  const [layout, setLayout] = useState<LayoutRectangle | null>(null);
  const triggerRef = useRef<NativeView>(null);
  const close = useCallback(() => setLayout(null), []);
  const value = useMemo(() => ({ close, layout, setLayout, triggerRef }), [close, layout]);
  return <DropdownContext.Provider value={value}>{children}</DropdownContext.Provider>;
}
export const Dropdown = Object.assign(DropdownRoot, { Trigger, Content, Item });

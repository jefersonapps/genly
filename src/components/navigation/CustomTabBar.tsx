import { AnimatedGlowButton } from "@/components/ui/AnimatedGlowButton";
import { useLibraryStore } from "@/store/useLibraryStore";
import { libraryCreationRoute } from "@/navigation/libraryCreation";
import { useTheme } from "@/providers/ThemeProvider";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shadows } from "@/theme/shadows";
import type { BottomTabBarProps } from "expo-router/tabs";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
    Wallet as IconFinances,
    Home as IconHome,
    Plus as IconPlus,
    Wrench as IconTool,
    User as IconUser,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { TabButton } from "./TabButton";

export function CustomTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { primaryColor, resolvedTheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isDark = resolvedTheme === "dark";
  const backgroundColor = isDark ? "#0A0A0A" : "#FFFFFF";

  const [layout, setLayout] = useState({ width: 0, height: 0 });
  
  // Padding horizontal of the container
  const CONTAINER_PADDING = 8;
  // 5 slots: Home, Tools, [Plus], Finances, User
  const TAB_COUNT = 5;
  // Subtract 16 for horizontal padding (px-2) and 2 for borders (1px each side)
  const tabWidth = (layout.width - (CONTAINER_PADDING * 2) - 2) / TAB_COUNT;

  // Map state index (0..3) to visual position (0, 1, 3, 4)
  // state.routes = ["index", "tools", "finances", "settings"]
  const getVisualIndex = (stateIndex: number) => {
    if (stateIndex === 0) return 0; // Home
    if (stateIndex === 1) return 1; // Tools
    if (stateIndex === 2) return 3; // Finances (skip 2 which is Plus)
    if (stateIndex === 3) return 4; // Settings
    return 0;
  };

  const activeVisualIndex = getVisualIndex(state.index);
  
  const translateX = useSharedValue(0);
  const lastIndicatorTarget = useRef<number | null>(null);
  const moveIndicator = useCallback((visualIndex: number) => {
    if (tabWidth <= 0) return;
    const target = visualIndex * tabWidth - 2;
    if (lastIndicatorTarget.current === target) return;
    const initial = lastIndicatorTarget.current === null;
    lastIndicatorTarget.current = target;
    translateX.value = initial ? target : withTiming(target, { duration: 160, easing: Easing.out(Easing.cubic) });
  }, [tabWidth, translateX]);

  useEffect(() => { moveIndicator(activeVisualIndex); }, [activeVisualIndex, moveIndicator]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout(current => current.width === width && current.height === height ? current : { width, height });
  };

  // Tab Configuration
  const TAB_ITEMS = [
    { type: 'screen', routeName: 'index', icon: IconHome },
    { type: 'screen', routeName: 'tools', icon: IconTool },
    { type: 'button', icon: IconPlus }, // Center button
    { type: 'screen', routeName: 'finances', icon: IconFinances },
    { type: 'screen', routeName: 'settings', icon: IconUser },
  ];

  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 items-center justify-center"
      style={{ height: 100 + insets.bottom, paddingBottom: insets.bottom }}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { top: -24 }]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="tabBackgroundFade" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0" stopColor={backgroundColor} stopOpacity={0} />
              <Stop offset="0.35" stopColor={backgroundColor} stopOpacity={0.4} />
              <Stop offset="0.7" stopColor={backgroundColor} stopOpacity={0.95} />
              <Stop offset="1" stopColor={backgroundColor} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#tabBackgroundFade)" />
        </Svg>
      </View>
      <View
        onLayout={onLayout}
        className="flex-row bottom-3 w-[90%] rounded-[32px] h-16 border items-center px-2"
        style={[
          {
            // Keep the pill solid above the background gradient.
            backgroundColor: isDark ? "#121212" : "#FFFFFF",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
          },
          shadows.lg
        ]}
      >
        {/* Animated Background Indicator */}
        {layout.width > 0 && (
          <View className="absolute inset-0 justify-center px-2" pointerEvents="none" style={{ left: 1, right: 1 }}>
            <Animated.View
              className="h-12"
              style={[
                {
                  width: tabWidth + 4,
                  backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                  borderRadius: 24,
                },
                animatedStyle,
              ]}
            />
          </View>
        )}

        {/* Render Tabs Uniformly */}
        {TAB_ITEMS.map((item, index) => {
          if (item.type === 'button') {
            return (
              <View key="plus-button" className="flex-1 items-center justify-center">
                <AnimatedGlowButton
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    const library = useLibraryStore.getState();
                    const group = state.routes[state.index]?.name === 'index'
                      ? library.groups.find(item => item.id === library.selectedGroupId)
                      : null;
                    router.push(libraryCreationRoute(group));
                  }}
                  color={primaryColor}
                  icon={<IconPlus size={24} color="#FFF" />}
                  size={48}
                  glowSize={70}
                />
              </View>
            );
          }

          const isFocused = state.index === (index > 2 ? index - 1 : index);
          
          return (
            <View key={item.routeName} className="flex-1 items-center justify-center">
              <TabButton
                icon={item.icon!}
                isFocused={isFocused}
                accessibilityRole="tab"
                accessibilityLabel={item.routeName === 'index' ? 'Início' : item.routeName === 'tools' ? 'Ferramentas' : item.routeName === 'finances' ? 'Finanças' : 'Configurações'}
                accessibilityState={{ selected: isFocused }}
                onPress={() => {
                  if (isFocused) return;
                  const route = state.routes.find(route => route.name === item.routeName);
                  if (!route) return;
                  moveIndicator(index);
                  navigateToTab(route.key);
                  void Haptics.selectionAsync().catch(() => {});
                }}
                noBackground
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

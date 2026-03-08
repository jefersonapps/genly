import { AnimatedGlowButton } from "@/components/ui/AnimatedGlowButton";
import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
    Wallet as IconFinances,
    Home as IconHome,
    Plus as IconPlus,
    Wrench as IconTool,
    User as IconUser,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { LayoutChangeEvent, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { TabButton } from "./TabButton";

export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { primaryColor, resolvedTheme } = useTheme();
  const router = useRouter();
  const isDark = resolvedTheme === "dark";

  const [layout, setLayout] = useState({ width: 0, height: 0 });
  
  // Padding horizontal of the container
  const CONTAINER_PADDING = 8;
  // 5 slots: Home, Tools, [Plus], Finances, User
  const TAB_COUNT = 5;
  // Subtract 16 for horizontal padding (px-2) and 2 for borders (1px each side)
  const tabWidth = (layout.width - (CONTAINER_PADDING * 2) - 2) / TAB_COUNT;
  const INDICATOR_WIDTH = 60; // Fixed width for better alignment

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
  const scaleX = useSharedValue(1);
  const scaleY = useSharedValue(1);

  useEffect(() => {
    if (tabWidth > 0) {
      // 1px compensation for border + 2px offset to center the wider pill (+4px width)
      const targetX = (activeVisualIndex * tabWidth) - 2;
      
      // "Liquid" effect: stretch while moving - Reduced intensity
      scaleX.value = withSequence(
        withTiming(1.15, { duration: 150, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }),
        withSpring(1, { damping: 20, stiffness: 200 })
      );
      
      scaleY.value = withSequence(
        withTiming(0.95, { duration: 150 }), 
        withSpring(1, { damping: 20, stiffness: 200 })
      );

      translateX.value = withSpring(targetX, {
        damping: 25, // Increased damping to reduce bounce
        stiffness: 220,
        mass: 1,
      });
    }
  }, [activeVisualIndex, tabWidth]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { scaleX: scaleX.value },
        { scaleY: scaleY.value },
      ],
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    setLayout(e.nativeEvent.layout);
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
      className="absolute bottom-0 left-0 right-0 h-[100px] items-center justify-center"
    >
      <View
        onLayout={onLayout}
        className="flex-row bottom-3 w-[90%] rounded-[32px] h-16 border items-center px-2"
        style={[
          {
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
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push("/task/editor");
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
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate(item.routeName!);
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

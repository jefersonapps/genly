import { CustomTabBar } from "@/components/navigation/CustomTabBar";
import { ScreenContext, ScreenProvider } from "@/providers/ScreenProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { Tabs, useRouter, type Href } from "expo-router";
import { scheduleIdleTask } from "@/utils/idle";
import React, { useCallback, useContext, useEffect, useRef } from "react";
import { BlurTargetView } from "expo-blur";
import { useFocusEffect } from "expo-router";
import { View } from "react-native";

export default function TabLayout() {
  return (
    <ScreenProvider>
      <TabNavigator />
    </ScreenProvider>
  );
}

const TAB_PREFETCH: Href[] = ['/(tabs)/tools', '/(tabs)/finances', '/(tabs)/settings'];

function TabNavigator() {
  const router = useRouter();
  useEffect(() => {
    let index = 0;
    let cancelled = false;
    let cancel: () => void;
    const warmNextTab = () => {
      if (cancelled || index >= TAB_PREFETCH.length) return;
      router.prefetch(TAB_PREFETCH[index++]);
      if (index < TAB_PREFETCH.length) cancel = scheduleIdleTask(warmNextTab, 2000);
    };
    cancel = scheduleIdleTask(warmNextTab, 2000);
    return () => { cancelled = true; cancel(); };
  }, [router]);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const backgroundColor = isDark ? "#0A0A0A" : "#FFFFFF";

  return (
    <Tabs
      screenLayout={({ children }) => <TabBackdrop>{children}</TabBackdrop>}
      screenOptions={{
        headerShown: false,
        animation: "none",
        sceneStyle: { backgroundColor }, // for newer React Navigation / Expo Router
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home" }}
      />
      <Tabs.Screen
        name="tools"
        options={{ title: "Ferramentas" }}
      />
      <Tabs.Screen
        name="finances"
        options={{ title: "Finanças" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
    </Tabs>
  );
}

// Only screen content belongs to the blur target; the tab bar stays outside it.
function TabBackdrop({ children }: { children: React.ReactNode }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const { setScreenRef } = useContext(ScreenContext);
  useFocusEffect(useCallback(() => {
    setScreenRef(ref.current);
    // Keep the current target until the next focused tab registers its view.
    // Clearing it here would unmount and recreate the blur on every switch.
  }, [setScreenRef]));
  return <BlurTargetView ref={ref} style={{ flex: 1 }}>{children}</BlurTargetView>;
}

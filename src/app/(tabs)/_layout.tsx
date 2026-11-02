import { CustomTabBar } from "@/components/navigation/CustomTabBar";
import { useTheme } from "@/providers/ThemeProvider";
import { Tabs, useRouter, type Href } from "expo-router";
import { scheduleIdleTask } from "@/utils/idle";
import React, { useEffect } from "react";

const TAB_PREFETCH: Href[] = ['/(tabs)/tools', '/(tabs)/finances', '/(tabs)/settings'];

export default function TabLayout() {
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

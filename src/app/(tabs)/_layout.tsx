import { CustomTabBar } from "@/components/navigation/CustomTabBar";
import { ScreenProvider } from "@/providers/ScreenProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <ScreenProvider>
      <TabNavigator />
    </ScreenProvider>
  );
}

function TabNavigator() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const backgroundColor = isDark ? "#0A0A0A" : "#FFFFFF";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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

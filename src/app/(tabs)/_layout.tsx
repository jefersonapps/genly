import { CustomTabBar } from "@/components/navigation/CustomTabBar";
import { ScreenContext, ScreenProvider } from "@/providers/ScreenProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { Tabs } from "expo-router";
import React, { useCallback, useContext, useRef } from "react";
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

function TabNavigator() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const backgroundColor = isDark ? "#0A0A0A" : "#FFFFFF";

  return (
    <Tabs
      screenLayout={({ children }) => <TabBackdrop>{children}</TabBackdrop>}
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

// Only screen content belongs to the blur target; the tab bar stays outside it.
function TabBackdrop({ children }: { children: React.ReactNode }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const { setScreenRef } = useContext(ScreenContext);
  useFocusEffect(useCallback(() => {
    setScreenRef(ref.current);
    return () => setScreenRef(null);
  }, [setScreenRef]));
  return <BlurTargetView ref={ref} style={{ flex: 1 }}>{children}</BlurTargetView>;
}

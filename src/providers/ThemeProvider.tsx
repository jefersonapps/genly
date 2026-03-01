import { vars } from "nativewind";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
    type PropsWithChildren,
} from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import {
    getSetting,
    setSetting
} from "../services/settingsService";

// ─── Types ────────────────────────────────────────────
type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  themeMode: ThemeMode;
  resolvedTheme: "light" | "dark";
  primaryColor: string;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setPrimaryColor: (color: string) => Promise<void>;
  themeVars: ReturnType<typeof vars>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Helper: hex to RGB string ────────────────────────
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

import { View } from "react-native";

// ─── Provider ─────────────────────────────────────────
export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [primaryColor, setPrimaryColorState] = useState("#208AEF");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const mode = (await getSetting("theme_mode")) as ThemeMode;
      const color = await getSetting("primary_color");
      setThemeModeState(mode);
      setPrimaryColorState(color);
      setLoaded(true);
    })();
  }, []);

  const resolvedTheme: "light" | "dark" =
    themeMode === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : themeMode;

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await setSetting("theme_mode", mode);
    // Explicitly update widgets to reflect the new theme
    const { triggerAllWidgetsUpdate } = require("../widgets/widget-task-handler");
    triggerAllWidgetsUpdate();
  }, []);

  const setPrimaryColor = useCallback(async (color: string) => {
    setPrimaryColorState(color);
    await setSetting("primary_color", color);
    // Explicitly update widgets to reflect the new primary color
    const { triggerAllWidgetsUpdate } = require("../widgets/widget-task-handler");
    triggerAllWidgetsUpdate();
  }, []);

  const isDark = resolvedTheme === "dark";

  const themeVars = vars({
    "--color-primary": hexToRgb(primaryColor),
    "--color-surface": isDark ? "10 10 10" : "255 255 255",
    "--color-surface-secondary": isDark ? "23 23 23" : "245 245 245",
    "--color-on-surface": isDark ? "245 245 245" : "10 10 10",
    "--color-on-surface-secondary": isDark ? "163 163 163" : "115 115 115",
    "--color-muted": isDark ? "115 115 115" : "163 163 163",
    "--color-border": isDark ? "38 38 38" : "229 229 229",
  });

  if (!loaded) return null;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        resolvedTheme,
        primaryColor,
        setThemeMode,
        setPrimaryColor,
        themeVars,
      }}
    >
      <View style={[{ flex: 1 }, themeVars]} className={isDark ? "dark" : ""}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

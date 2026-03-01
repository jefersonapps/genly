/**
 * Widget theme colors — mirrors the app Colors from constants/theme.ts
 * but structured for widget primitives (no hooks).
 */

import type { ColorProp } from 'react-native-android-widget';

export interface WidgetThemeColors {
  bg: ColorProp;
  bgCard: ColorProp;
  bgHeader: ColorProp;
  text: ColorProp;
  textSecondary: ColorProp;
  border: ColorProp;
  primary: ColorProp;
  accent: ColorProp;
}

export function getWidgetColors(
  mode: "light" | "dark",
  primaryColor: string = "#208AEF"
): WidgetThemeColors {
  // Ensure primaryColor starts with # for ColorProp compatibility
  const pc = (primaryColor.startsWith('#') ? primaryColor : `#${primaryColor}`) as ColorProp;
  const accentDark = `${pc}30` as ColorProp;
  const accentLight = `${pc}20` as ColorProp;

  if (mode === "dark") {
    return {
      bg: '#0A0A0A',
      bgCard: '#1A1A1D',
      bgHeader: '#141416',
      text: '#F5F5F5',
      textSecondary: '#A3A3A3',
      border: '#262626',
      primary: pc,
      accent: accentDark,
    };
  }

  return {
    bg: '#FFFFFF',
    bgCard: '#F5F5F5',
    bgHeader: '#FAFAFA',
    text: '#0A0A0A',
    textSecondary: '#737373',
    border: '#E5E5E5',
    primary: pc,
    accent: accentLight,
  };
}

/**
 * Format a date string for display in widgets.
 * Returns something like "01/03" or "01/03 14:30"
 */
export function formatWidgetDate(
  dateStr: string | null,
  timeStr?: string | null
): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    if (timeStr) {
      return `${day}/${month} ${timeStr.substring(0, 5)}`;
    }
    return `${day}/${month}`;
  } catch {
    return dateStr;
  }
}

/**
 * Truncate text for widget display
 */
export function truncate(text: string, maxLen: number = 35): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 1) + "…";
}



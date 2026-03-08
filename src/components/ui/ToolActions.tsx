import { useTheme } from "@/providers/ThemeProvider";
import React from "react";
import { Text, TouchableOpacity, View, ViewStyle } from "react-native";

interface ToolActionsProps {
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle;
}

interface ToolActionButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  color?: string; // Specific color for the icon background
  title: string;
  description: string;
  className?: string;
  style?: ViewStyle;
}

const ToolActionsContext = React.createContext<{ primaryColor: string; isDark: boolean } | null>(null);

function ToolActions({ children, className, style }: ToolActionsProps) {
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <ToolActionsContext.Provider value={{ primaryColor, isDark }}>
      <View className={`w-full gap-4 ${className || ""}`} style={style}>
        {children}
      </View>
    </ToolActionsContext.Provider>
  );
}

function ToolActionButton({ onPress, icon, color, title, description, className, style }: ToolActionButtonProps) {
  const context = React.useContext(ToolActionsContext);
  if (!context) throw new Error("ToolActionButton must be used within ToolActions");

  const { primaryColor, isDark } = context;
  const { withOpacity } = require("@/utils/colors");
  
  const iconBackgroundColor = color ? withOpacity(color, 0.1) : withOpacity(primaryColor, 0.1);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`w-full flex-row items-center p-5 bg-surface-secondary rounded-2xl border border-border ${className || ""}`}
      style={style}
    >
      <View 
        style={{ backgroundColor: iconBackgroundColor }}
        className="h-12 w-12 rounded-full items-center justify-center mr-4"
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text className="font-sans-semibold text-base text-on-surface">{title}</Text>
        <Text className="font-sans text-sm text-on-surface-secondary">{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

ToolActions.Button = ToolActionButton;

export { ToolActions };

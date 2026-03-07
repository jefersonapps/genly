import { useTheme } from "@/providers/ThemeProvider";
import { ChevronRight } from "lucide-react-native";
import React from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";

interface SettingsRowProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  iconBackgroundColor?: string;
  toggle?: {
    value: boolean;
    onValueChange: (value: boolean) => void;
  };
  disabled?: boolean;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = false,
  toggle,
  disabled = false,
  iconBackgroundColor,
}: SettingsRowProps) {
  const { primaryColor } = useTheme();

  const content = (
    <View className="flex-row items-center px-4 py-3.5">
      <View 
        className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${!iconBackgroundColor ? 'bg-surface-secondary' : ''}`}
        style={iconBackgroundColor ? { backgroundColor: iconBackgroundColor } : undefined}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text className="font-sans-medium text-base text-on-surface">
          {title}
        </Text>
        {subtitle && (
          <Text className="mt-0.5 font-sans text-xs text-on-surface-secondary">
            {subtitle}
          </Text>
        )}
      </View>
      {toggle && (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          trackColor={{ false: "rgb(229,229,229)", true: primaryColor }}
          thumbColor="#fff"
        />
      )}
      {rightElement}
      {showChevron && <ChevronRight size={18} color="rgb(163,163,163)" />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.6} disabled={disabled} style={disabled && { opacity: 0.5 }}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

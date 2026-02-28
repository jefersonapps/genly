import { useTheme } from "@/providers/ThemeProvider";
import { clsx } from "clsx";
import { TabTriggerSlotProps } from "expo-router/ui";
import React from "react";
import { Pressable, Text, View } from "react-native";

interface TabButtonProps extends TabTriggerSlotProps {
  icon: React.ElementType;
  label?: string;
}

export const TabButton = React.forwardRef<View, TabButtonProps & { noBackground?: boolean }>(
  ({ icon: Icon, label, isFocused, noBackground, ...props }, ref) => {
    const { resolvedTheme } = useTheme();

    return (
      <Pressable
        ref={ref}
        {...props}
        className="flex-1 items-center justify-center" // Removed py-2
      >
        <View
          className={clsx(
            "items-center justify-center px-5 overflow-hidden", // Removed py-2
            isFocused && !noBackground && (resolvedTheme === "dark" ? "bg-white/10" : "bg-black/5")
          )}
          style={{ borderRadius: 24, height: 48 }} // Fixed height to match indicator
        >
          <Icon
            size={24}
            color={
              isFocused
                ? resolvedTheme === "dark" ? "#FFF" : "#000"
                : resolvedTheme === "dark" ? "#666" : "#AAA"
            }
            strokeWidth={isFocused ? 2.5 : 2}
          />
          {/* Optional label if we want to match some designs, but reference image is icon-only */}
          {label && (
            <Text
              className={clsx(
                "mt-1 text-[10px] font-sans-medium",
                isFocused ? "text-on-surface" : "text-on-surface-secondary"
              )}
            >
              {label}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }
);

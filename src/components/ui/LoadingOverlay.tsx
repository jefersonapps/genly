import { useTheme } from "@/providers/ThemeProvider";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  description?: string;
}

export function LoadingOverlay({
  visible,
  title = "Processando...",
  description,
}: LoadingOverlayProps) {
  const { primaryColor } = useTheme();

  if (!visible) return null;

  return (
    <View className="absolute z-[100] inset-0 items-center justify-center bg-black/60">
      <View className="bg-surface rounded-2xl p-6 border border-border shadow-2xl items-center mx-6">
        <ActivityIndicator size="large" color={primaryColor} />
        <Text className="mt-4 font-sans-semibold text-on-surface text-center text-lg">
          {title}
        </Text>
        {description && (
          <Text className="mt-2 font-sans text-on-surface-secondary text-center leading-relaxed">
            {description}
          </Text>
        )}
      </View>
    </View>
  );
}

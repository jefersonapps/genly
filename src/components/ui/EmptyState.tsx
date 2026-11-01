import React from "react";
import { Text, View } from "react-native";

interface EmptyStateProps {
  compact?: boolean;
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ compact = false, icon, title, description, action }: EmptyStateProps) {
  return (
    <View className={`flex-1 items-center justify-center ${compact ? "px-2 py-8" : "px-8 py-16"}`}>
      <View className="mb-4">{icon}</View>
      <Text className="mb-2 text-center font-sans-semibold text-lg text-on-surface">
        {title}
      </Text>
      {description && (
        <Text className="mb-6 text-center font-sans text-sm text-on-surface-secondary">
          {description}
        </Text>
      )}
      {action && <View className={compact ? "w-full max-w-sm" : "w-full"}>{action}</View>}
    </View>
  );
}

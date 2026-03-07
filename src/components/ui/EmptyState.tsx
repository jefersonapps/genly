import React from "react";
import { Text, View } from "react-native";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      <View className="mb-4">{icon}</View>
      <Text className="mb-2 text-center font-sans-semibold text-lg text-on-surface">
        {title}
      </Text>
      {description && (
        <Text className="mb-6 text-center font-sans text-sm text-on-surface-secondary">
          {description}
        </Text>
      )}
      {action && <View className="w-full">{action}</View>}
    </View>
  );
}

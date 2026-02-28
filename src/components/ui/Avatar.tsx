import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { clsx } from "clsx";
import { User } from "lucide-react-native";

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: "sm" | "md" | "lg";
  onPress?: () => void;
}

const SIZES = {
  sm: { container: "h-9 w-9", icon: 16, text: "text-xs" },
  md: { container: "h-12 w-12", icon: 20, text: "text-sm" },
  lg: { container: "h-20 w-20", icon: 32, text: "text-lg" },
};

export function Avatar({ uri, name, size = "md", onPress }: AvatarProps) {
  const s = SIZES[size];

  const content = uri ? (
    <Image
      source={{ uri }}
      className={clsx("rounded-full", s.container)}
      contentFit="cover"
    />
  ) : (
    <View
      className={clsx(
        "items-center justify-center rounded-full bg-surface-secondary",
        s.container,
      )}
    >
      {name ? (
        <Text className={clsx("font-sans-bold text-on-surface-secondary", s.text)}>
          {name.charAt(0).toUpperCase()}
        </Text>
      ) : (
        <User size={s.icon} color="rgb(115,115,115)" />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

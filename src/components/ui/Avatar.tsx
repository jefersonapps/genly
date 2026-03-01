import { useTheme } from "@/providers/ThemeProvider";
import { clsx } from "clsx";
import { Image } from "expo-image";
import { User } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

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
  const { primaryColor } = useTheme();
  const s = SIZES[size];

  const content = (
    <View 
      className="rounded-full items-center justify-center"
      style={{ 
        borderWidth: 2, 
        borderColor: primaryColor,
        padding: 3,
        width: (size === 'lg' ? 80 : size === 'md' ? 48 : 36) + 10,
        height: (size === 'lg' ? 80 : size === 'md' ? 48 : 36) + 10,
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          className={clsx("rounded-full", s.container)}
          style={{ 
            width: size === 'lg' ? 80 : size === 'md' ? 48 : 36, 
            height: size === 'lg' ? 80 : size === 'md' ? 48 : 36,
            borderRadius: 9999
          }}
          contentFit="cover"
        />
      ) : (
        <View
          className={clsx(
            "items-center justify-center rounded-full bg-surface-secondary",
            s.container,
          )}
          style={{ 
            width: size === 'lg' ? 80 : size === 'md' ? 48 : 36, 
            height: size === 'lg' ? 80 : size === 'md' ? 48 : 36,
            borderRadius: 9999
          }}
        >
          {name ? (
            <Text className={clsx("font-sans-bold text-on-surface-secondary", s.text)}>
              {name.charAt(0).toUpperCase()}
            </Text>
          ) : (
            <User size={s.icon} color="rgb(115,115,115)" />
          )}
        </View>
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

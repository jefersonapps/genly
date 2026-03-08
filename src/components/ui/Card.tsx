import { shadows } from "@/theme/shadows";
import { clsx } from "clsx";
import React from "react";
import { View, type ViewProps } from "react-native";

interface CardProps extends ViewProps {
  variant?: "elevated" | "flat";
}

export function Card({
  variant = "flat",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <View
      className={clsx(
        "rounded-2xl p-4",
        variant === "flat" && "bg-surface-secondary",
        variant === "elevated" && "bg-surface",
        className,
      )}
      style={[
        variant === "elevated" && shadows.sm,
        props.style
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

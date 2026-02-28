import React from "react";
import { View, type ViewProps } from "react-native";
import { clsx } from "clsx";

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
        variant === "elevated" && "bg-surface shadow-sm shadow-black/5",
        className,
      )}
      {...props}
    >
      {children}
    </View>
  );
}

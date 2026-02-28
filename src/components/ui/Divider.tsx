import React from "react";
import { View } from "react-native";
import { clsx } from "clsx";

interface DividerProps {
  className?: string;
}

export function Divider({ className }: DividerProps) {
  return <View className={clsx("h-px w-full bg-border", className)} />;
}

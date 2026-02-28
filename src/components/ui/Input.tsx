import React from "react";
import { TextInput, View, Text, type TextInputProps } from "react-native";
import { clsx } from "clsx";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <View className="w-full">
      {label && (
        <Text className="mb-1.5 font-sans-medium text-sm text-on-surface-secondary">
          {label}
        </Text>
      )}
      <TextInput
        className={clsx(
          "w-full rounded-xl bg-surface-secondary px-4 py-3 font-sans text-base text-on-surface",
          error && "border border-red-500",
          className,
        )}
        placeholderTextColor="rgb(163, 163, 163)"
        {...props}
      />
      {error && (
        <Text className="mt-1 font-sans text-xs text-red-500">{error}</Text>
      )}
    </View>
  );
}

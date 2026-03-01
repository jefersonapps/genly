import { useKeyboard } from "@/hooks/useKeyboard";
import React from "react";
import {
  KeyboardAvoidingViewProps,
  Platform,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
} from "react-native";

/**
 * Custom KeyboardAvoidingView that fixes a common Android bug where extra padding 
 * remains after closing the keyboard when using behavior="height" or "padding".
 * 
 * It automatically monitors keyboard visibility and enables/disables the avoiding 
 * logic based on visibility on Android.
 */
export function KeyboardAvoidingView({ 
  children, 
  enabled = true,
  ...props 
}: KeyboardAvoidingViewProps) {
  const { isVisible } = useKeyboard();

  // Bug fix for Android: Only enable KeyboardAvoidingView when keyboard is visible
  const isEnabled = enabled && (Platform.OS === "ios" || isVisible);

  return (
    <RNKeyboardAvoidingView
      {...props}
      enabled={isEnabled}
    >
      {children}
    </RNKeyboardAvoidingView>
  );
}

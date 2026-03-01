import { Button } from "@/components/ui/Button";
import { KeyboardAvoidingView } from "@/components/ui/KeyboardAvoidingView";
import { useTheme } from "@/providers/ThemeProvider";
import React, { useEffect, useState } from "react";
import {
    Modal,
    Platform,
    Text,
    TextInput,
    View,
} from "react-native";

interface PromptModalProps {
  visible: boolean;
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  formatInput?: (text: string) => string;
  onCancel: () => void;
  onConfirm: (text: string) => void;
}

export function PromptModal({
  visible,
  title,
  message,
  defaultValue = "",
  placeholder = "",
  keyboardType = "default",
  formatInput,
  onCancel,
  onConfirm,
}: PromptModalProps) {
  const { resolvedTheme } = useTheme();
  const [value, setValue] = useState(defaultValue);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
    }
  }, [visible, defaultValue]);

  const handleConfirm = () => {
    onConfirm(value);
    setValue("");
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 justify-center bg-black/60 px-6"
      >
        <View className="bg-surface rounded-[2.5rem] p-6 border border-border shadow-xl">
          <Text className="font-sans-bold text-xl text-on-surface mb-2">{title}</Text>
          <Text className="font-sans text-on-surface-secondary mb-6">{message}</Text>
          
          <TextInput
            value={value}
            onChangeText={(t) => setValue(formatInput ? formatInput(t) : t)}
            placeholder={placeholder}
            placeholderTextColor={isDark ? "#71717a" : "#a1a1aa"}
            keyboardType={keyboardType}
            className="bg-surface-secondary rounded-2xl px-5 py-4 font-sans text-on-surface border border-border mb-8"
            autoFocus
          />
          
          <View className="flex-row justify-end gap-3">
            <Button variant="ghost" rounded="full" onPress={onCancel}>
              <Button.Text>Cancelar</Button.Text>
            </Button>
            
            <Button rounded="full" onPress={handleConfirm}>
              <Button.Text>Confirmar</Button.Text>
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

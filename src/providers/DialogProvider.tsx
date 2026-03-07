import { Dialog, type DialogButtonVariant } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { useTheme } from "@/providers/ThemeProvider";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react-native";
import React, { createContext, useCallback, useContext, useState, type PropsWithChildren } from "react";
import { View } from "react-native";

// ─── Types ───────────────────────────────────────
interface DialogButtonOption {
  text: string;
  variant?: DialogButtonVariant;
  onPress?: () => void | Promise<void>;
  icon?: React.ReactNode;
}

export type DialogVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface DialogOptions {
  title: string;
  description?: string;
  buttons?: DialogButtonOption[];
  icon?: React.ReactNode;
  variant?: DialogVariant;
  prompt?: {
    defaultValue?: string;
    placeholder?: string;
    onConfirm: (text: string) => void | Promise<void>;
    autoFocus?: boolean;
    formatInput?: (text: string) => string;
  };
}

interface DialogContextValue {
  show: (options: DialogOptions) => void;
  hide: () => void;
}

// ─── Context ─────────────────────────────────────
const DialogContext = createContext<DialogContextValue | null>(null);

// ─── Provider ────────────────────────────────────
export function DialogProvider({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const show = useCallback((opts: DialogOptions) => {
    setOptions(opts);
    if (opts.prompt) {
        setPromptValue(opts.prompt.defaultValue || "");
    }
    setVisible(true);
  }, []);

  const hide = useCallback(() => {
    setVisible(false);
    setOptions(null);
    setPromptValue("");
  }, []);

  const resolvedButtons = options?.buttons?.length
    ? options.buttons
    : [{ text: "OK", variant: "default" as DialogButtonVariant }];

  const renderIcon = () => {
    if (options?.icon) return options.icon;
    
    const size = 24;
    switch (options?.variant) {
      case 'success':
        return <CheckCircle2 size={size} color="#22C55E" />; // Green
      case 'warning':
        return <AlertTriangle size={size} color="#F59E0B" />; // Orange
      case 'error':
        return <XCircle size={size} color="#EF4444" />; // Red
      case 'info':
        return <Info size={size} color="#3B82F6" />; // Blue
      default:
        return null;
    }
  };

  return (
    <DialogContext.Provider value={{ show, hide }}>
      {children}
      <Dialog visible={visible} onClose={hide}>
        {options && (
          <>
            <Dialog.Header>
              <Dialog.Title icon={renderIcon()}>{options.title}</Dialog.Title>
              {options.description ? (
                <Dialog.Description>{options.description}</Dialog.Description>
              ) : null}
            </Dialog.Header>

            {options.prompt && (
              <View className="mb-6">
                <Input
                   value={promptValue}
                   onChangeText={(text) => {
                     const formatted = options.prompt?.formatInput ? options.prompt.formatInput(text) : text;
                     setPromptValue(formatted);
                   }}
                   placeholder={options.prompt.placeholder}
                   autoFocus={options.prompt.autoFocus !== false}
                />
              </View>
            )}

            <Dialog.Footer>
              {resolvedButtons.map((btn, i) => (
                <Dialog.Button
                  key={i}
                  variant={btn.variant}
                  onPress={async () => {
                    if (options.prompt && btn.variant !== 'ghost' && btn.variant !== 'outline') {
                       await options.prompt.onConfirm(promptValue);
                    }
                    if (btn.onPress) {
                      await btn.onPress();
                    }
                  }}
                  icon={btn.icon}
                >
                  {btn.text}
                </Dialog.Button>
              ))}
            </Dialog.Footer>
          </>
        )}
      </Dialog>
    </DialogContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────
export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useDialog must be used within DialogProvider");
  return ctx;
}

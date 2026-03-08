import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import React, { createContext, useContext } from "react";
import {
    Animated,
    Modal,
    Platform,
    Pressable,
    Text,
    TouchableOpacity,
    View,
    type TextProps,
    type ViewProps,
} from "react-native";
import { KeyboardAvoidingView } from "./KeyboardAvoidingView";

// ─── Types ───────────────────────────────────────
type DialogButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

interface DialogRootProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

interface DialogTitleProps extends Omit<TextProps, "children"> {
  children: string;
  icon?: React.ReactNode;
}

interface DialogDescriptionProps extends Omit<TextProps, "children"> {
  children: string;
}

interface DialogHeaderProps extends ViewProps {
  children: React.ReactNode;
}

interface DialogFooterProps extends ViewProps {
  children: React.ReactNode;
}

interface DialogButtonProps {
  children: string;
  variant?: DialogButtonVariant;
  onPress?: () => void | Promise<void>;
  disabled?: boolean;
  icon?: React.ReactNode;
}

// ─── Context ─────────────────────────────────────
interface DialogContextValue {
  onClose: () => void;
}

const DialogCtx = createContext<DialogContextValue>({ onClose: () => {} });

// ─── Sub-components ──────────────────────────────
function DialogTitle({ children, style, icon, ...props }: DialogTitleProps) {
  return (
    <View className="flex-row items-center gap-3 mb-2" style={style} {...props as any}>
      {icon && (
        <View className="p-2 rounded-full bg-border/10">
          {icon}
        </View>
      )}
      <Text className="font-sans-bold text-xl text-on-surface flex-1">
        {children}
      </Text>
    </View>
  );
}

function DialogDescription({ children, style, ...props }: DialogDescriptionProps) {
  return (
    <Text
      className="font-sans text-base text-on-surface-secondary leading-relaxed mb-6"
      style={style}
      {...props}
    >
      {children}
    </Text>
  );
}

function DialogHeader({ children, style, ...props }: DialogHeaderProps) {
  return (
    <View
      className="flex flex-col gap-1.5 text-center sm:text-left mb-4"
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}

function DialogFooter({ children, style, ...props }: DialogFooterProps) {
  return (
    <View
      className="flex-row justify-end gap-2 mt-2"
      style={style}
      {...props}
    >
      {children}
    </View>
  );
}

function DialogButton({
  children,
  variant = "default",
  onPress,
  disabled,
  icon,
}: DialogButtonProps) {
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { onClose } = useContext(DialogCtx);

  const [loading, setLoading] = React.useState(false);

  const handlePress = async () => {
    if (onPress) {
      const result = onPress();
      if (result instanceof Promise) {
        setLoading(true);
        try {
          await result;
        } finally {
          setLoading(false);
        }
      }
    }
    onClose();
  };

  const getBgStyle = () => {
    switch (variant) {
      case "default":
        return { backgroundColor: primaryColor };
      case "destructive":
        return { backgroundColor: "#EF4444" }; 
      case "secondary":
        return { backgroundColor: isDark ? "#27272A" : "#F4F4F5" }; // zinc-800 or zinc-100
      case "ghost":
        return { backgroundColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)" };
      case "outline":
      case "link":
        return { backgroundColor: "transparent", borderWidth: variant === 'outline' ? 1 : 0, borderColor: isDark ? "#3F3F46" : "#E4E4E7" };
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "default":
      case "destructive":
        return "#FFFFFF";
      case "secondary":
      case "ghost":
      case "outline":
      case "link":
        return isDark ? "#FAFAFA" : "#18181B";
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      className={`rounded-xl overflow-hidden flex-row items-center justify-center gap-2 ${variant === 'outline' ? 'border border-border' : ''}`}
      style={[
        {
          paddingHorizontal: 16,
          paddingVertical: 10,
          opacity: disabled || loading ? 0.5 : 1,
        },
        getBgStyle(),
      ]}
    >
      {icon && !loading && (
        <View className="mr-1">
           {icon}
        </View>
      )}
      <Text
        className="font-sans-bold text-sm text-center"
        style={[{ color: getTextColor() }, variant === 'link' ? { textDecorationLine: 'underline' } : {}]}
      >
        {loading ? "..." : children}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Root ────────────────────────────────────────
function DialogRoot({ visible, onClose, children }: DialogRootProps) {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <DialogCtx.Provider value={{ onClose }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Animated.View
            style={[
              {
                flex: 1,
                justifyContent: "center",
                paddingHorizontal: 24,
                backgroundColor: "rgba(0,0,0,0.6)",
                opacity: fadeAnim,
              },
            ]}
          >
            <Pressable
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
              onPress={onClose}
            />
            <Animated.View
              style={{ transform: [{ scale: scaleAnim }] }}
            >
              <View className="bg-surface rounded-2xl p-6 border border-border" style={shadows['2xl']}>
                {children}
              </View>
            </Animated.View>
          </Animated.View>
        </KeyboardAvoidingView>
      </DialogCtx.Provider>
    </Modal>
  );
}

// ─── Compound Export ─────────────────────────────
export const Dialog = Object.assign(DialogRoot, {
  Title: DialogTitle,
  Description: DialogDescription,
  Header: DialogHeader,
  Footer: DialogFooter,
  Button: DialogButton,
});

export type { DialogButtonProps, DialogButtonVariant, DialogRootProps };


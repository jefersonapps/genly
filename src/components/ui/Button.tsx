import { useTheme } from "@/providers/ThemeProvider";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react-native";
import React, { createContext, useContext } from "react";
import {
    ActivityIndicator,
    Text as RNText,
    TouchableOpacity, type TextProps,
    type TouchableOpacityProps,
    type ViewStyle
} from "react-native";

// ─── Types ───────────────────────────────────────
type ButtonVariant = "filled" | "outline" | "ghost" | "danger" | "icon";
type ButtonSize = "sm" | "md" | "lg";
type ButtonRounded = "default" | "full";

interface ButtonRootProps extends TouchableOpacityProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  rounded?: ButtonRounded;
  loading?: boolean;
  color?: string;
  children: React.ReactNode;
}

interface ButtonTextProps extends Omit<TextProps, "children"> {
  children: string;
  className?: string;
}

interface ButtonIconProps {
  icon: LucideIcon | React.ReactNode;
  size?: number;
  color?: string;
}

// ─── Context ─────────────────────────────────────
interface ButtonContext {
  variant: ButtonVariant;
  size: ButtonSize;
  resolvedColor: string;
  iconColor: string;
  textColor: string;
  disabled: boolean;
}

const Ctx = createContext<ButtonContext>({
  variant: "filled",
  size: "md",
  resolvedColor: "#6366f1",
  iconColor: "#FFF",
  textColor: "#FFF",
  disabled: false,
});

// ─── Size Maps ───────────────────────────────────
const PADDING: Record<ButtonSize, string> = {
  sm: "px-4 py-2",
  md: "px-6 py-3",
  lg: "px-8 py-4",
};

const ICON_SIZES: Record<ButtonSize, { container: string; icon: number }> = {
  sm: { container: "h-9 w-9", icon: 18 },
  md: { container: "h-11 w-11", icon: 22 },
  lg: { container: "h-14 w-14", icon: 26 },
};

const TEXT_SIZES: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

// ─── Sub-components ──────────────────────────────
function ButtonText({ children, className, ...props }: ButtonTextProps) {
  const ctx = useContext(Ctx);
  return (
    <RNText
      className={clsx(
        "font-sans-bold",
        TEXT_SIZES[ctx.size],
        className,
      )}
      style={[{ color: ctx.textColor }, props.style]}
      {...props}
    >
      {children}
    </RNText>
  );
}

function ButtonIcon({ icon, size: customSize, color: customColor }: ButtonIconProps) {
  const ctx = useContext(Ctx);
  const resolvedSize = customSize ?? ICON_SIZES[ctx.size].icon;
  const resolvedColor = customColor ?? ctx.iconColor;

  // If icon is a Lucide component (function or forwardRef), call it with size/color
  if (typeof icon === "function" || (typeof icon === "object" && icon !== null && "render" in (icon as any))) {
    const Icon = icon as any;
    return <Icon size={resolvedSize} color={resolvedColor} />;
  }

  // Otherwise it's already a ReactNode — render as-is
  return <>{icon}</>;
}

// ─── Root ────────────────────────────────────────
function ButtonRoot({
  variant = "filled",
  size = "md",
  rounded = "default",
  loading = false,
  color,
  disabled,
  className,
  style,
  children,
  ...props
}: ButtonRootProps) {
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const resolvedColor = color ?? primaryColor;
  const isDisabled = disabled || loading;

  // Determine colors based on variant
  let iconColor: string;
  let textColor: string;

  switch (variant) {
    case "filled":
      iconColor = "#FFF";
      textColor = "#FFF";
      break;
    case "danger":
      iconColor = "#FFF";
      textColor = "#FFF";
      break;
    case "outline":
      iconColor = isDark ? "#FAFAFA" : "#18181B";
      textColor = isDark ? "#FAFAFA" : "#18181B";
      break;
    case "ghost":
      iconColor = isDark ? "#A1A1AA" : "#71717A";
      textColor = isDark ? "#A1A1AA" : "#71717A";
      break;
    case "icon":
      iconColor = isDark ? "#FAFAFA" : "#18181B";
      textColor = isDark ? "#FAFAFA" : "#18181B";
      break;
  }

  const isIcon = variant === "icon";
  const roundedClass = rounded === "full" || isIcon ? "rounded-full" : "rounded-2xl";

  const ctx: ButtonContext = {
    variant,
    size,
    resolvedColor,
    iconColor,
    textColor,
    disabled: isDisabled,
  };

  return (
    <Ctx.Provider value={ctx}>
      <TouchableOpacity
        disabled={isDisabled}
        activeOpacity={0.7}
        className={clsx(
          "flex-row items-center justify-center",
          roundedClass,
          // Background
          variant === "filled" && "shadow-sm",
          variant === "outline" && "border border-border bg-transparent",
          variant === "ghost" && "bg-transparent",
          variant === "danger" && "shadow-sm",
          variant === "icon" && "bg-surface-secondary",
          // Sizing
          isIcon ? ICON_SIZES[size].container : PADDING[size],
          // Disabled
          isDisabled && "opacity-50",
          className,
        )}
        style={[
          variant === "filled" && { backgroundColor: resolvedColor },
          variant === "danger" && { backgroundColor: "#EF4444" },
          style as ViewStyle,
        ]}
        {...props}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === "filled" || variant === "danger" ? "#FFF" : resolvedColor}
          />
        ) : (
          children
        )}
      </TouchableOpacity>
    </Ctx.Provider>
  );
}

// ─── Compound Export ─────────────────────────────
export const Button = Object.assign(ButtonRoot, {
  Text: ButtonText,
  Icon: ButtonIcon,
});

export type { ButtonRootProps, ButtonRounded, ButtonSize, ButtonVariant };


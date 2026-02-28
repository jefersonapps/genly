import { useTheme } from "@/providers/ThemeProvider";
import { LucideIcon } from "lucide-react-native";
import React, {
  createContext,
  forwardRef,
  useContext,
  useRef,
  useState
} from "react";
import {
  LayoutRectangle,
  Modal,
  Text as RNText,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";
import Animated, {
  FadeOut,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Context ─────────────────────────────────────
interface DropdownContextType {
  close: () => void;
  layout: LayoutRectangle | null;
  setLayout: (layout: LayoutRectangle) => void;
}
const DropdownContext = createContext<DropdownContextType | null>(null);

// ─── Trigger ─────────────────────────────────────
interface TriggerProps {
  children: React.ReactElement;
  asChild?: boolean;
}

const Trigger = forwardRef<View, TriggerProps>(({ children, asChild }, ref) => {
  const context = useContext(DropdownContext);
  const triggerRef = useRef<View>(null);

  const measureAndOpen = () => {
    triggerRef.current?.measure((x, y, width, height, pageX, pageY) => {
      context?.setLayout({ x: pageX, y: pageY, width, height });
    });
  };

  const childElement = children as React.ReactElement;
  
  const childProps = {
    ref: triggerRef,
    onPress: (e: any) => {
      measureAndOpen();
      // Call original onPress if exists
      if (childElement.props && (childElement.props as any).onPress) {
        (childElement.props as any).onPress(e);
      }
    },
  };

  return React.cloneElement(childElement, childProps);
});

// ─── Content ─────────────────────────────────────
interface ContentProps {
  children: React.ReactNode;
  width?: number;
  align?: "start" | "end" | "center";
  direction?: "top" | "bottom";
}

function Content({ children, width = 200, align = "start", direction = "bottom" }: ContentProps) {
  const context = useContext(DropdownContext);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const insets = useSafeAreaInsets();

  if (!context?.layout) return null;

  const { x, y, width: tWidth, height: tHeight } = context.layout;

  let left = x;
  if (align === "end") {
    left = x + tWidth - width;
  } else if (align === "center") {
    left = x + tWidth / 2 - width / 2;
  }

  // Basic boundary check for left
  if (left < 10) left = 10;
  // TODO: check right boundary if needed

  // Position above or below? Default below
  let top = y + tHeight + 4;
  let bottom: number | undefined;

  if (direction === "top") {
    // If opening upwards, we position relative to the top of the trigger
    // But we don't know the content height easily without measuring.
    // However, we can use bottom positioning if we are careful.
    // The Modal uses absolute positioning.
    // top = y - contentHeight - 4;
    // Just using `bottom` style in the absolute view might work if we set top to undefined?
    // But we need to know the window height to calculate precise 'top' if we want to animate from there?
    // Let's try setting `bottom` style instead of `top` for the View.
    // layout.y is distance from top.
    // distance from bottom = windowHeight - y.
    // so user wants menu ABOVE trigger.
    // bottom of menu = y - 4? No.
    // View style: { bottom: windowHeight - y + 4 }
    // We need window height.
    top = undefined as any;
  }

  const renderMenu = (calculatedStyle: any) => (
    <Animated.View
      style={[
        styles.menu,
        calculatedStyle,
        {
          width,
          backgroundColor: isDark ? "#18181B" : "#FFFFFF",
          borderColor: isDark ? "#27272A" : "#E4E4E7",
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
        },
      ]}
      entering={(values: any) => {
        "worklet";
        const animations = {
          transform: [
            {
              translateY: withSpring(0, {
                damping: 18,
                stiffness: 120,
                mass: 1,
              }),
            },
            {
              scale: withSpring(1, {
                damping: 18,
                stiffness: 120,
                mass: 1,
              }),
            },
          ],
          opacity: withTiming(1, { duration: 200 }),
        };

        const initialValues = {
          transform: [
            {
              translateY: direction === "top" ? 10 : -10,
            },
            { scale: 0.9 },
          ],
          opacity: 0,
          originX: values.targetOriginX,
          originY: values.targetOriginY,
          width: values.targetWidth,
          height: values.targetHeight,
          globalOriginX: values.targetGlobalOriginX,
          globalOriginY: values.targetGlobalOriginY,
        };

        return {
          initialValues,
          animations,
        };
      }}
      exiting={FadeOut.duration(150)}
    >
      {children}
    </Animated.View>
  );

  return (
    <Modal
      transparent
      visible={!!context.layout}
      onRequestClose={context.close}
      animationType="none"
    >
      <TouchableWithoutFeedback onPress={context.close}>
        <View style={styles.overlay}>
          <ContextDimensions 
            direction={direction} 
            align={align}
            triggerLayout={context.layout} 
            menuWidth={width}
          >
            {renderMenu}
          </ContextDimensions>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

import { useWindowDimensions } from "react-native";

// Helper to get window dimensions safely
function ContextDimensions({ direction, align, triggerLayout, menuWidth, children }: any) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { x, y, width: tWidth, height: tHeight } = triggerLayout;

  let style: any = {};
  
  // Vertical positioning: Add a 4px gap for breathing room
  if (direction === "top") {
    // Position menu's bottom edge above the trigger
    style.bottom = windowHeight - y + 8;
  } else {
    // Position menu's top edge below the trigger
    style.top = y + tHeight + 8;
  }

  // Horizontal positioning
  if (align === "end") {
    // Align right edge of menu with right edge of trigger
    let rightPos = windowWidth - (x + tWidth);
    if (rightPos < 10) rightPos = 10; // safety padding
    style.right = rightPos;
  } else if (align === "center") {
    let leftPos = x + (tWidth / 2) - (menuWidth / 2);
    if (leftPos < 10) leftPos = 10;
    if (leftPos + menuWidth > windowWidth - 10) leftPos = windowWidth - menuWidth - 10;
    style.left = leftPos;
  } else {
    // start (default)
    let leftPos = x;
    if (leftPos + menuWidth > windowWidth - 10) leftPos = windowWidth - menuWidth - 10;
    if (leftPos < 10) leftPos = 10;
    style.left = leftPos;
  }

  return children(style);
}

// ─── Item ────────────────────────────────────────
interface ItemProps {
  icon?: LucideIcon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

function Item({ icon: Icon, label, onPress, destructive }: ItemProps) {
  const context = useContext(DropdownContext);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handlePress = () => {
    context?.close();
    requestAnimationFrame(() => {
      onPress();
    });
  };

  const textColor = destructive ? "#EF4444" : isDark ? "#E4E4E7" : "#3F3F46";

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.item,
        destructive && { backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#FEF2F2" },
      ]}
    >
      {Icon && <Icon size={18} color={textColor} style={{ marginRight: 10 }} />}
      <RNText style={[styles.itemText, { color: textColor }]}>{label}</RNText>
    </TouchableOpacity>
  );
}

// ─── Root ────────────────────────────────────────
interface DropdownProps {
  children: React.ReactNode;
}

function DropdownRoot({ children }: DropdownProps) {
  const [layout, setLayout] = useState<LayoutRectangle | null>(null);

  const close = () => setLayout(null);

  return (
    <DropdownContext.Provider value={{ close, layout, setLayout }}>
      {children}
    </DropdownContext.Provider>
  );
}

// ─── Compound Export ─────────────────────────────
export const Dropdown = Object.assign(DropdownRoot, {
  Trigger,
  Content,
  Item,
});

// ─── Styles ──────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    // Transparent background to catch clicks outside
  },
  menu: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    padding: 6,
    elevation: 8,
    // Add zIndex if needed depending on parent, but Modal usually handles it.
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 2,
  },
  itemText: {
    fontSize: 14,
    fontWeight: "600",
  },
});

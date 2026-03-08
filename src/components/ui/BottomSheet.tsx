import { useTheme } from "@/providers/ThemeProvider";
import { shadows } from "@/theme/shadows";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import React, { useCallback } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SettingsRow } from "../settings/SettingsRow";
import { Button } from "./Button";

// --- ROOT COMPONENT ---
interface BottomSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  snapPoints: string[];
  children: React.ReactNode;
  onDismiss?: () => void;
}

export const BottomSheet = ({ sheetRef, snapPoints, children, onDismiss }: BottomSheetProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: isDark ? "#18181b" : "#f4f4f5" }}
      handleIndicatorStyle={{ backgroundColor: isDark ? "#52525b" : "#d4d4d8" }}
      onDismiss={onDismiss}
    >
      {children}
    </BottomSheetModal>
  );
};

// --- VIEW COMPONENT ---
interface BottomSheetViewProps {
  children: React.ReactNode;
  className?: string;
  paddingBottomOffset?: number;
}

const BottomSheetWrapper = ({ children, className = "", paddingBottomOffset = 24 }: BottomSheetViewProps) => {
  const insets = useSafeAreaInsets();
  
  return (
    <BottomSheetView 
      className={`p-6 gap-4 ${className}`} 
      style={{ paddingBottom: Math.max(insets.bottom, paddingBottomOffset) }}
    >
      {children}
    </BottomSheetView>
  );
};
BottomSheet.View = BottomSheetWrapper;

// --- HEADER COMPONENT ---
interface BottomSheetHeaderProps {
  title: string;
  subtitle?: string;
}

const BottomSheetHeader = ({ title, subtitle }: BottomSheetHeaderProps) => {
  return (
    <View className="mb-2">
      <Text className="font-sans-bold text-xl text-on-surface">{title}</Text>
      {subtitle && (
        <Text className="font-sans text-sm text-on-surface-secondary -mt-1">
          {subtitle}
        </Text>
      )}
    </View>
  );
};
BottomSheet.Header = BottomSheetHeader;

// --- ITEM GROUP COMPONENT ---
interface BottomSheetItemGroupProps {
  children: React.ReactNode;
}

const BottomSheetItemGroup = ({ children }: BottomSheetItemGroupProps) => {
  return (
    <View className="overflow-hidden rounded-2xl bg-surface-secondary" style={shadows.lg}>
      {children}
    </View>
  );
};
BottomSheet.ItemGroup = BottomSheetItemGroup;

// --- ITEM COMPONENT ---
interface BottomSheetItemProps {
  icon: React.ReactNode;
  iconBackgroundColor?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showChevron?: boolean;
  containerStyle?: object;
}

const BottomSheetItem = ({ icon, iconBackgroundColor, title, subtitle, onPress, showChevron = false, containerStyle }: BottomSheetItemProps) => {
  return (
    <SettingsRow
      icon={icon}
      iconBackgroundColor={iconBackgroundColor}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      showChevron={showChevron}
      containerStyle={containerStyle}
    />
  );
};
BottomSheet.Item = BottomSheetItem;

// --- SEPARATOR COMPONENT ---
const BottomSheetSeparator = () => {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === "dark";
    
    return (
        <View 
            style={{ 
                height: 1, 
                backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", 
                marginHorizontal: 16 
            }} 
        />
    );
};
BottomSheet.Separator = BottomSheetSeparator;

// --- PRIMARY BUTTON COMPONENT ---
interface BottomSheetButtonProps extends React.ComponentProps<typeof Button> {
    className?: string;
}

const BottomSheetPrimaryButton = ({ className, children, ...props }: BottomSheetButtonProps) => {
    return (
        <Button 
            className={`w-full ${className || ''}`}
            {...props}
        >
            {typeof children === 'string' ? <Button.Text>{children}</Button.Text> : children}
        </Button>
    );
}
BottomSheet.Button = BottomSheetPrimaryButton;

export default BottomSheet;

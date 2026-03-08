import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useTheme } from "@/providers/ThemeProvider";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import React from "react";
import {
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Preset colors are now in the ColorPicker component

export default function AppearanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode, primaryColor, setPrimaryColor, resolvedTheme } =
    useTheme();
  const isDark = resolvedTheme === "dark";

  // Colors based on current theme (for the screen itself)
  const colors = {
    bg: isDark ? "#0A0A0A" : "#FFFFFF",
    surface: isDark ? "#171717" : "#F5F5F5",
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    border: isDark ? "#262626" : "#E5E5E5",
  };

  const ThemeCard = ({
    mode,
    label,
    isActive,
    onPress,
  }: {
    mode: "light" | "dark";
    label: string;
    isActive: boolean;
    onPress: () => void;
  }) => {
    // Mini-mockup colors
    const cardBg = mode === "dark" ? "#171717" : "#FFFFFF";
    const cardBorder = mode === "dark" ? "#333" : "#E5E5E5";
    const mockText1 = mode === "dark" ? "#52525B" : "#D4D4D8"; // dim
    const mockText2 = mode === "dark" ? "#3F3F46" : "#E4E4E7"; // dimmer
    const mockAccent = mode === "dark" ? primaryColor : primaryColor;

    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        className="items-center gap-2 flex-1"
      >
        <View
          className="w-full aspect-[0.65] rounded-xl overflow-hidden"
          style={[
            {
              backgroundColor: cardBg,
              borderColor: isActive ? primaryColor : cardBorder,
              borderWidth: isActive ? 2 : 1,
            },
          ]}
        >
          {/* Mini App UI Mockup */}
          <View style={{ padding: 12, width: "100%", height: "100%", gap: 8 }}>
            {/* Header Mock */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: 'center' }}>
                <View style={{ width: 40, height: 6, borderRadius: 3, backgroundColor: mockText1 }} />
                <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: mockText1 }} />
            </View>
            
            {/* Content Mock 1 */}
            <View
              style={{
                height: 24,
                width: "100%",
                borderRadius: 6,
                backgroundColor: mode === "dark" ? "#262626" : "#F4F4F5",
                marginBottom: 4
              }}
            />
             {/* Content Mock 2 */}
             <View
              style={{
                height: 24,
                width: "70%",
                borderRadius: 6,
                backgroundColor: mode === "dark" ? "#262626" : "#F4F4F5",
              }}
            />

            {/* Bottom Bar Mock */}
            <View className="mt-auto flex-row items-center justify-around px-1">
                 <View className="w-3 h-3 rounded-full" style={[{ backgroundColor: mockText2 }]} />
                 
                 {/* FAB mimic */}
                 <View className="w-6 h-6 rounded-full items-center justify-center" style={[{ backgroundColor: primaryColor }]}>
                    <View className="w-2.5 h-0.5 rounded-sm" style={[{ backgroundColor: '#FFF' }]} />
                    <View className="absolute w-0.5 h-2.5 rounded-sm" style={[{ backgroundColor: '#FFF' }]} />
                 </View>
 
                 <View className="w-3 h-3 rounded-full" style={[{ backgroundColor: mockText2 }]} />
            </View>
          </View>

          {/* Active Checkmark Overlay */}
          {isActive && (
            <View className="absolute bottom-2 right-2 w-5 h-5 rounded-full items-center justify-center" style={[{ backgroundColor: primaryColor }]}>
              <Check size={12} color="#FFF" />
            </View>
          )}
        </View>
        <Text
          className={`text-sm ${isActive ? 'font-sans-bold' : 'font-sans'}`}
          style={{
            color: isActive ? colors.text : colors.textSecondary,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1" style={[{ backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View 
        className="flex-row items-center justify-between px-4 py-3 border-b" 
        style={[{ borderBottomColor: colors.border }]}
      >
        <Button variant="icon" onPress={() => router.back()}>
          <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
        </Button>
        <Text className="text-lg font-sans-bold" style={[{ color: colors.text }]}>Aparência</Text>
        <View className="w-10" /> 
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* ── Theme Mode Section ── */}
        <View className="mb-6">
          <Text className="text-[13px] font-sans-semibold mb-3 tracking-[0.5px] opacity-60" style={[{ color: colors.text }]}>TEMA</Text>
          
          <View className="flex-row gap-4">
            <ThemeCard
              mode="light"
              label="Claro"
              isActive={themeMode === "light"}
              onPress={() => setThemeMode("light")}
            />
            <ThemeCard
              mode="dark"
              label="Escuro"
              isActive={themeMode === "dark"}
              onPress={() => setThemeMode("dark")}
            />
          </View>
 
          <View className="flex-row items-center justify-between p-4 rounded-xl mt-4" style={[{ backgroundColor: colors.surface }]}>
            <Text className="text-base font-sans-medium" style={[{ color: colors.text }]}>Automático</Text>
            <Switch
              value={themeMode === "system"}
              onValueChange={(val) => setThemeMode(val ? "system" : isDark ? "dark" : "light")}
              trackColor={{ false: "#767577", true: primaryColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>
          <Text className="text-xs font-sans mt-2 px-1" style={[{ color: colors.textSecondary }]}>
            Se ativado, o Genly seguirá as configurações de aparência do seu sistema.
          </Text>
        </View>

        {/* ── Accent Color Section ── */}
        <View className="mb-6">
          <Text className="text-[13px] font-sans-semibold mb-3 tracking-[0.5px] opacity-60 mt-6" style={[{ color: colors.text }]}>
            COR DE DESTAQUE
          </Text>
          
          <ColorPicker
            selectedColor={primaryColor}
            onSelect={(color) => setPrimaryColor(color)}
            isDark={isDark}
            colors={["#208AEF", "#6a57e3", "#22c55e", "#f97316", "#ec4899", "#ef4444", "#14b8a6", "#eab308"]}
          />
        </View>
 
      </ScrollView>
    </View>
  );
}

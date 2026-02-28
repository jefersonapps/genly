import { Button } from "@/components/ui/Button";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useTheme } from "@/providers/ThemeProvider";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import React from "react";
import {
    ScrollView,
    StyleSheet,
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
        style={{ alignItems: "center", gap: 8, flex: 1 }}
      >
        <View
          style={[
            styles.cardContainer,
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
            <View style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4 }}>
                 <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: mockText2 }} />
                 
                 {/* FAB mimic */}
                 <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 10, height: 2, backgroundColor: '#FFF', borderRadius: 1 }} />
                    <View style={{ position: 'absolute', width: 2, height: 10, backgroundColor: '#FFF', borderRadius: 1 }} />
                 </View>

                 <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: mockText2 }} />
            </View>
          </View>

          {/* Active Checkmark Overlay */}
          {isActive && (
            <View style={[styles.activeBadge, { backgroundColor: primaryColor }]}>
              <Check size={12} color="#FFF" />
            </View>
          )}
        </View>
        <Text
          style={{
            color: isActive ? colors.text : colors.textSecondary,
            fontWeight: isActive ? "700" : "400",
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Button variant="icon" onPress={() => router.back()}>
          <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
        </Button>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Aparência</Text>
        <View style={{ width: 40 }} /> 
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Theme Mode Section ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>TEMA</Text>
          
          <View style={styles.cardsRow}>
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

          <View style={[styles.row, { backgroundColor: colors.surface, marginTop: 16 }]}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>Automático</Text>
            <Switch
              value={themeMode === "system"}
              onValueChange={(val) => setThemeMode(val ? "system" : isDark ? "dark" : "light")}
              trackColor={{ false: "#767577", true: primaryColor }}
              thumbColor={"#f4f3f4"}
            />
          </View>
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            Se ativado, o Genly seguirá as configurações de aparência do seu sistema.
          </Text>
        </View>

        {/* ── Accent Color Section ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 24 }]}>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginBottom: 12, opacity: 0.6, letterSpacing: 0.5 },
  cardsRow: { flexDirection: "row", gap: 16 },
  cardContainer: {
    width: "100%",
    aspectRatio: 0.65, // mimic phone ratio
    borderRadius: 12,
    overflow: "hidden",
  },
  activeBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
  },
  rowLabel: { fontSize: 16, fontWeight: "500" },
  helperText: { fontSize: 12, marginTop: 8, paddingHorizontal: 4 },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'flex-start'
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  colorCheck: {
      // Optional drop shadow for better visibility on light colors
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 1,
      elevation: 2,
  }
});

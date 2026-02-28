import { X } from "lucide-react-native";
import React, { useState } from "react";
import {
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface ColorPickerModalProps {
  visible: boolean;
  title: string;
  currentColor: string;
  onSelect: (color: string) => void;
  onClose: () => void;
  isDark: boolean;
}

const PRESET_COLORS = [
  // Row 1 – Neutrals
  "#000000", "#333333", "#555555", "#888888", "#AAAAAA", "#CCCCCC", "#EEEEEE", "#FFFFFF",
  // Row 2 – Vibrant
  "#F44336", "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#2196F3", "#03A9F4", "#00BCD4",
  // Row 3 – Nature
  "#009688", "#4CAF50", "#8BC34A", "#CDDC39", "#FFEB3B", "#FFC107", "#FF9800", "#FF5722",
  // Row 4 – Pastel
  "#FFCDD2", "#F8BBD0", "#E1BEE7", "#D1C4E9", "#C5CAE9", "#BBDEFB", "#B3E5FC", "#B2EBF2",
];

export function ColorPickerModal({ visible, title, currentColor, onSelect, onClose, isDark }: ColorPickerModalProps) {
  const [customHex, setCustomHex] = useState(currentColor);

  const colors = {
    bg: isDark ? "#1A1A1A" : "#FFFFFF",
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    border: isDark ? "#333" : "#E5E5E5",
    inputBg: isDark ? "#262626" : "#F5F5F5",
  };

  const handleCustomSubmit = () => {
    let hex = customHex.trim();
    if (!hex.startsWith("#")) hex = "#" + hex;
    if (/^#[0-9A-Fa-f]{3,8}$/.test(hex)) {
      onSelect(hex);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={[styles.container, { backgroundColor: colors.bg }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current color preview */}
            <View style={styles.previewRow}>
              <View
                style={[
                  styles.previewSwatch,
                  {
                    backgroundColor: currentColor,
                    borderColor: colors.border,
                  },
                ]}
              />
              <Text style={[styles.previewHex, { color: colors.text }]}>
                {currentColor.toUpperCase()}
              </Text>
            </View>

            {/* Color grid */}
            <View style={styles.grid}>
              {PRESET_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => onSelect(color)}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: color,
                      borderColor: currentColor === color ? "#6366f1" : colors.border,
                      borderWidth: currentColor === color ? 2.5 : 1,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Custom hex */}
            <View style={styles.customRow}>
              <Text style={[styles.customLabel, { color: colors.textSecondary }]}>Hex:</Text>
              <TextInput
                value={customHex}
                onChangeText={setCustomHex}
                onSubmitEditing={handleCustomSubmit}
                placeholder="#000000"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                style={[
                  styles.customInput,
                  { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
                ]}
              />
              <TouchableOpacity
                onPress={handleCustomSubmit}
                style={[styles.customBtn, { backgroundColor: "#6366f1" }]}
              >
                <Text style={styles.customBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  container: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  previewSwatch: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
  },
  previewHex: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 8,
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  customInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: "monospace",
  },
  customBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  customBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
});

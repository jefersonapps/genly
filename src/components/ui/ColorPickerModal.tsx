import { shadows } from "@/theme/shadows";
import { X } from "lucide-react-native";
import React, { useState } from "react";
import {
    Modal,
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
      <TouchableOpacity 
        activeOpacity={1} 
        className="flex-1 bg-black/50 justify-center items-center p-6" 
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}} className="w-full max-w-[360px]">
          <View 
            className="w-full rounded-[20px] p-5"
            style={[ { backgroundColor: colors.bg }, shadows.lg]}
          >
            {/* Header */}
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-lg font-sans-bold" style={{ color: colors.text }}>{title}</Text>
              <TouchableOpacity activeOpacity={0.8} onPress={onClose}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current color preview */}
            <View className="flex-row items-center mb-4 gap-3">
              <View
                className="w-9 h-9 rounded-xl border-2"
                style={[
                  {
                    backgroundColor: currentColor,
                    borderColor: colors.border,
                  },
                ]}
              />
              <Text className="text-base font-sans-semibold" style={{ color: colors.text }}>
                {currentColor.toUpperCase()}
              </Text>
            </View>

            {/* Color grid */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              {PRESET_COLORS.map((color) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  key={color}
                  onPress={() => onSelect(color)}
                  className="w-[34px] h-[34px] rounded-lg"
                  style={[
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
            <View className="flex-row items-center gap-2">
              <Text className="text-sm font-sans-semibold" style={{ color: colors.textSecondary }}>Hex:</Text>
              <TextInput
                value={customHex}
                onChangeText={setCustomHex}
                onSubmitEditing={handleCustomSubmit}
                placeholder="#000000"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="characters"
                className="flex-1 h-10 rounded-xl border px-3 text-sm font-sans"
                style={[
                  { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
                ]}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCustomSubmit}
                className="h-10 px-4 rounded-xl items-center justify-center bg-[#6366f1]"
              >
                <Text className="text-white font-sans-bold text-sm">OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

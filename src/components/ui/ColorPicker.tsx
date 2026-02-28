import { Check } from "lucide-react-native";
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export const PRESET_COLORS = [
  "#000000",
  "#FFFFFF",
  "#208AEF", // Blue
  "#6a57e3", // Purple
  "#22c55e", // Green
  "#f97316", // Orange
  "#ec4899", // Pink
  "#ef4444", // Red
  "#14b8a6", // Teal
  "#eab308", // Yellow
];

interface ColorPickerProps {
  selectedColor: string;
  onSelect: (color: string) => void;
  colors?: string[];
  isDark?: boolean;
}

export function ColorPicker({ 
  selectedColor, 
  onSelect, 
  colors = PRESET_COLORS,
  isDark
}: ColorPickerProps) {
  return (
    <View 
      style={[
        styles.colorGrid, 
        { 
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
          borderWidth: 1,
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
        }
      ]}
    >
      {colors.map((color) => {
        const isSelected = selectedColor.toLowerCase() === color.toLowerCase();
        // Determine border/check color for visibility
        const isWhite = color.toLowerCase() === "#ffffff" || color.toLowerCase() === "#fff";
        
        return (
          <TouchableOpacity
            key={color}
            activeOpacity={0.7}
            onPress={() => onSelect(color)}
            style={[
              styles.colorSwatch,
              { backgroundColor: color },
              isSelected && { 
                borderColor: isDark ? "#FFF" : "#000", 
                borderWidth: 2 
              },
            ]}
          >
            {isSelected && (
               <View style={styles.colorCheck}>
                 <Check 
                    size={14} 
                    color={isWhite ? "#000" : "#FFF"} 
                />
               </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    padding: 16,
    borderRadius: 20,
    justifyContent: 'flex-start'
  },
  colorSwatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  colorCheck: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  }
});

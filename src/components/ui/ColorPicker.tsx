import { shadows } from "@/theme/shadows";
import { Check, Plus, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";
import { runOnJS } from 'react-native-reanimated';
import ReanimatedColorPicker, { HueSlider, OpacitySlider, Panel1, Preview } from 'reanimated-color-picker';

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
  const [showModal, setShowModal] = useState(false);
  const [sessionCustomColors, setSessionCustomColors] = useState<string[]>([]);

  const handleColorComplete = (colorObj: { hex: string }) => {
    const newColor = colorObj.hex;
    onSelect(newColor);
    if (!colors.includes(newColor) && !sessionCustomColors.includes(newColor)) {
      setSessionCustomColors([...sessionCustomColors, newColor]);
    }
  };

  const allColors = useMemo(() => {
    const combined = [...colors, ...sessionCustomColors];
    if (selectedColor && !combined.some(c => c.toLowerCase() === selectedColor.toLowerCase())) {
      combined.push(selectedColor);
    }
    return combined;
  }, [colors, sessionCustomColors, selectedColor]);

  return (
    <View>
      <View 
        className="flex-row flex-wrap gap-3 p-4 rounded-[20px] justify-center border"
        style={{ 
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
          borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"
        }}
      >
        {allColors.map((color) => {
          const isSelected = selectedColor.toLowerCase() === color.toLowerCase();
          // Determine border/check color for visibility
          const isWhite = color.toLowerCase() === "#ffffff" || color.toLowerCase() === "#fff";
          
          return (
            <TouchableOpacity
              key={color}
              activeOpacity={0.8}
              onPress={() => onSelect(color)}
              className="w-11 h-11 rounded-full items-center justify-center"
              style={[
                { backgroundColor: color },
                shadows.sm,
                isSelected && { 
                  borderColor: isDark ? "#FFF" : "#000", 
                  borderWidth: 2 
                },
              ]}
            >
              {isSelected && (
                 <View style={shadows.sm}>
                   <Check 
                      size={14} 
                      color={isWhite ? "#000" : "#FFF"} 
                  />
                 </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Add custom color button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setShowModal(true)}
          className="w-11 h-11 rounded-full items-center justify-center border-2 border-dashed"
          style={{
            borderColor: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
          }}
        >
          <Plus size={20} color={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)"} />
        </TouchableOpacity>
      </View>

      {/* Reanimated Color Picker Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View 
            className="p-6 rounded-t-[32px] gap-6"
            style={{ backgroundColor: isDark ? '#171717' : '#FFFFFF', paddingBottom: 40 }}
          >
            <View className="flex-row justify-between items-center mb-2">
              <Text className="font-sans-bold text-lg" style={{ color: isDark ? '#FFF' : '#000' }}>
                Cor Personalizada
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)} className="p-2">
                <X size={24} color={isDark ? '#FFF' : '#000'} />
              </TouchableOpacity>
            </View>

            <ReanimatedColorPicker 
              style={{ width: '100%', gap: 16 }} 
              value={selectedColor || '#208AEF'} 
              onComplete={(color) => {
                'worklet';
                runOnJS(handleColorComplete)(color);
              }}
            >
              <Preview hideInitialColor />
              <Panel1 />
              <HueSlider />
              <OpacitySlider />
            </ReanimatedColorPicker>
            
            <TouchableOpacity 
              onPress={() => setShowModal(false)}
              className="mt-4 py-4 rounded-full items-center justify-center"
              style={{ backgroundColor: isDark ? '#FFF' : '#000' }}
            >
              <Text className="font-sans-bold text-base" style={{ color: isDark ? '#000' : '#FFF' }}>
                Concluir
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

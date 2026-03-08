import type { Group } from '@/db/schema';
import { useTheme } from '@/providers/ThemeProvider';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface GroupChipListProps {
  groups: Group[];
  selectedGroupId: number | null;
  onSelect: (id: number | null) => void;
  /** Override accent color for chips; defaults to theme primaryColor */
  accentColor?: string;
  /** Show the "Geral" (all) chip; default true */
  showAllOption?: boolean;
}

export const GroupChipList: React.FC<GroupChipListProps> = ({
  groups,
  selectedGroupId,
  onSelect,
  accentColor,
  showAllOption = true,
}) => {
  const { resolvedTheme, primaryColor } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const accent = accentColor || primaryColor;

  const colors = {
    surfaceSecondary: isDark ? '#1e1e1e' : '#f4f4f5',
    text: isDark ? '#fafafa' : '#18181b',
    textSecondary: isDark ? '#a1a1aa' : '#71717a',
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-0"
      keyboardShouldPersistTaps="always"
    >
      {showAllOption && (
        <TouchableOpacity
          onPress={() => onSelect(null)}
          activeOpacity={0.8}
          className="flex-row items-center px-2.5 py-1.5 rounded-xl border"
          style={[
            {
              borderColor: selectedGroupId === null ? accent : 'transparent',
              backgroundColor:
                selectedGroupId === null ? accent + '15' : colors.surfaceSecondary,
            },
          ]}
        >
          {/* Mini stacked-cards icon */}
          <View className="w-6 h-6 items-center justify-center mr-1.5">
            <View
              className="absolute w-[14px] h-[18px] rounded-[3px] opacity-60"
              style={[
                { backgroundColor: '#3b82f6', transform: [{ rotate: '8deg' }, { translateX: 2 }] },
              ]}
            />
            <View
              className="w-[14px] h-[18px] rounded-[3px] border border-white/20"
              style={[
                { backgroundColor: '#f97316' },
              ]}
            />
          </View>
          <Text
            className="font-sans-semibold text-[13px]"
            style={[
              {
                color: selectedGroupId === null ? accent : colors.textSecondary,
              },
            ]}
          >
            Geral
          </Text>
        </TouchableOpacity>
      )}

      {groups.map((g) => (
        <TouchableOpacity
          key={g.id}
          onPress={() => onSelect(g.id)}
          activeOpacity={0.8}
          className="flex-row items-center px-2.5 py-1.5 rounded-xl border"
          style={[
            {
              borderColor:
                selectedGroupId === g.id
                  ? (g.color || primaryColor)
                  : 'transparent',
              backgroundColor:
                selectedGroupId === g.id
                  ? (g.color || primaryColor) + '15'
                  : colors.surfaceSecondary,
            },
          ]}
        >
          <View
            className="w-[18px] h-[18px] rounded-[6px] items-center justify-center mr-1.5"
            style={[
              { backgroundColor: g.color || primaryColor },
            ]}
          >
            <Text style={{ fontSize: 9 }}>{g.emoji}</Text>
          </View>
          <Text
            className="font-sans-semibold text-[13px]"
            style={[
              {
                color:
                  selectedGroupId === g.id
                    ? (g.color || primaryColor)
                    : colors.text,
              },
            ]}
            numberOfLines={1}
          >
            {g.name}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

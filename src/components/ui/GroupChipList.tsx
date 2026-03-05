import type { Group } from '@/db/schema';
import { useTheme } from '@/providers/ThemeProvider';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="always"
    >
      {showAllOption && (
        <TouchableOpacity
          onPress={() => onSelect(null)}
          activeOpacity={0.7}
          style={[
            styles.chip,
            {
              borderColor: selectedGroupId === null ? accent : 'transparent',
              backgroundColor:
                selectedGroupId === null ? accent + '15' : colors.surfaceSecondary,
            },
          ]}
        >
          {/* Mini stacked-cards icon */}
          <View style={styles.allIconContainer}>
            <View
              style={[
                styles.allIconBack,
                { backgroundColor: '#3b82f6' },
              ]}
            />
            <View
              style={[
                styles.allIconFront,
                { backgroundColor: '#f97316' },
              ]}
            />
          </View>
          <Text
            style={[
              styles.label,
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
          activeOpacity={0.7}
          style={[
            styles.chip,
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
            style={[
              styles.icon,
              { backgroundColor: g.color || primaryColor },
            ]}
          >
            <Text style={{ fontSize: 9 }}>{g.emoji}</Text>
          </View>
          <Text
            style={[
              styles.label,
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

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  icon: {
    width: 18,
    height: 18,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  label: {
    fontWeight: '600',
    fontSize: 13,
  },
  allIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  allIconBack: {
    position: 'absolute',
    width: 14,
    height: 18,
    borderRadius: 3,
    transform: [{ rotate: '8deg' }, { translateX: 2 }],
    opacity: 0.6,
  },
  allIconFront: {
    width: 14,
    height: 18,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});

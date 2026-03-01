import { SettingsRow } from '@/components/settings/SettingsRow';
import { Divider } from '@/components/ui/Divider';
import { TabHeader } from '@/components/ui/TabHeader';
import { ThemeProvider, useTheme } from '@/providers/ThemeProvider';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  View
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Group } from '../db/schema';
import { getAllWidgetGroups, getThemeSettings, saveWidgetConfig } from '../services/widgetDataService';

import "../global.css";

function WidgetConfigurationContent({ widgetInfo, renderWidget, setResult }: any) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const insets = useSafeAreaInsets();
  
  const scrollY = useSharedValue(0);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [groupsData] = await Promise.all([
          getAllWidgetGroups(),
          getThemeSettings(),
        ]);
        setGroups(groupsData);
      } catch (error) {
        console.error('Failed to load data for widget config:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const onSelectGroup = async (groupId: number) => {
    try {
      // 1. Persist configuration to database for reliable retrieval in handler
      await saveWidgetConfig(widgetInfo.widgetId, groupId);

      // 2. Load the handler dynamically to avoid circular dependencies
      const { getThemedWidget, triggerAllWidgetsUpdate } = require('./widget-task-handler');

      // 3. Render immediate update for this widget
      // Configuration screen's renderWidget ONLY accepts a single element, not a {light, dark} object.
      const themedWidget = await getThemedWidget('GroupWidget', groupId);
      const widgetToRender = themedWidget && 'light' in themedWidget
        ? (themedWidget as any)[resolvedTheme]
        : themedWidget;

      renderWidget(widgetToRender, { groupId: groupId });

      // 4. Trigger global background refresh to sync all instances
      triggerAllWidgetsUpdate();

      // Return success to close screen
      setResult('ok');
    } catch (error) {
      console.error('Failed to update widget configuration:', error);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-surface">
        <ActivityIndicator size="large" color={primaryColor} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      <TabHeader
        scrollY={scrollY}
        title="Configurar Widget"
        titleThreshold={[40, 60]}
        hasSlideIn
      />

      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 100
        }}
      >
        <View className="px-6 mb-6">
          <Text className="font-sans-bold text-3xl text-on-surface mt-1">Configurar Widget</Text>
          <Text className="font-sans text-base text-on-surface-secondary mt-2">
            Escolha um grupo para exibir as notas mais recentes na sua tela inicial.
          </Text>
        </View>

        <View className="px-5 pb-2">
          <Text className="font-sans-bold text-lg text-on-surface mb-2">Seus Grupos</Text>
        </View>

        <View className="mx-5 overflow-hidden rounded-2xl bg-surface-secondary">
          {groups.length === 0 ? (
             <View className="p-10 items-center">
                <Text className="font-sans-semibold text-lg text-on-surface mb-1">Nenhum grupo encontrado</Text>
                <Text className="font-sans text-sm text-on-surface-secondary">Crie um grupo no app primeiro.</Text>
             </View>
          ) : (
            groups.map((group, index) => (
              <React.Fragment key={group.id}>
                <SettingsRow
                  icon={
                    <View className="h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${group.color || primaryColor}25` }}>
                      <Text style={{ fontSize: 20 }}>{group.emoji || '📁'}</Text>
                    </View>
                  }
                  title={group.name}
                  subtitle="Toque para selecionar este grupo"
                  showChevron
                  onPress={() => onSelectGroup(group.id)}
                />
                {index < groups.length - 1 && <Divider className="opacity-50" />}
              </React.Fragment>
            ))
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

import { SafeAreaProvider } from 'react-native-safe-area-context';

export function WidgetConfigurationScreen(props: any) {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <WidgetConfigurationContent {...props} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

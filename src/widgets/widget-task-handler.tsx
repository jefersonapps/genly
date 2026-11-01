/** @jsxImportSource react */
import React from 'react';
import type { Group } from '../db/schema';
import type { WidgetTask } from './types';
import { WidgetUnavailable } from './WidgetUnavailable';
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from 'react-native-android-widget';

import {
  getAllWidgetGroups,
  getGroupById,
  getRecentByGroup,
  getRecentByGroupName,
  getRecentTasks,
  getReminders,
  getThemeSettings,
  getWidgetConfig,
} from '../services/widgetDataService';
import { getWidgetColors } from './theme';

import { GroupWidget } from './GroupWidget';
import { RecentFlashcardsWidget } from './RecentFlashcardsWidget';
import { RecentMindMapsWidget } from './RecentMindMapsWidget';
import { RecentTasksWidget } from './RecentTasksWidget';
import { RemindersWidget } from './RemindersWidget';

export const WIDGET_NAMES = ['Reminders', 'RecentTasks', 'RecentMindMaps', 'RecentFlashcards', 'GroupWidget'];

async function getWidgetContent(widgetName: string, configGroupId?: number): Promise<{ tasks: WidgetTask[]; group?: Group }> {
  switch (widgetName) {
    case 'Reminders': return { tasks: await getReminders(10) };
    case 'RecentTasks': return { tasks: await getRecentTasks(10) };
    case 'RecentMindMaps': return { tasks: await getRecentByGroupName('Mapas Mentais', 10) };
    case 'RecentFlashcards': return { tasks: await getRecentByGroupName('Flashcards', 10) };
    case 'GroupWidget': {
      let group = configGroupId ? await getGroupById(configGroupId) : undefined;
      if (!group) group = (await getAllWidgetGroups())[0];
      return group ? { group, tasks: await getRecentByGroup(group.id, 10) } : { tasks: [] };
    }
    default: return { tasks: [] };
  }
}

export async function getThemedWidget(
  widgetName: string,
  configGroupId?: number
): Promise<React.ReactElement | { light: React.ReactElement; dark: React.ReactElement }> {
  const [{ primaryColor, themeMode }, { tasks, group }] = await Promise.all([
    getThemeSettings(),
    getWidgetContent(widgetName, configGroupId),
  ]);
  const render = (mode: 'light' | 'dark') => {
    const colors = getWidgetColors(mode, primaryColor);
    switch (widgetName) {
      case 'Reminders': return <RemindersWidget tasks={tasks} colors={colors} />;
      case 'RecentMindMaps': return <RecentMindMapsWidget tasks={tasks} colors={colors} />;
      case 'RecentFlashcards': return <RecentFlashcardsWidget tasks={tasks} colors={colors} />;
      case 'GroupWidget':
        return group ? <GroupWidget group={group} tasks={tasks} colors={colors} /> : <RecentTasksWidget tasks={tasks} colors={colors} />;
      default: return <RecentTasksWidget tasks={tasks} colors={colors} />;
    }
  };
  if (themeMode === 'light' || themeMode === 'dark') return render(themeMode);
  return { light: render('light'), dark: render('dark') };
}

export async function triggerAllWidgetsUpdate() {
  for (const name of WIDGET_NAMES) {
    try {
      await requestWidgetUpdate({
        widgetName: name,
        renderWidget: async (props) => {
          let configGroupId: number | undefined;
          if (name === 'GroupWidget') {
            configGroupId = await getWidgetConfig(props.widgetId);
          }
          return getThemedWidget(name, configGroupId);
        }
      });
    } catch (e) {
      console.log(`[WidgetTrigger] Failed to update ${name}:`, e);
    }
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetName = props.widgetInfo.widgetName;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      try {
        // Only group widgets need an instance-specific configuration lookup.
        const configGroupId = widgetName === 'GroupWidget'
          ? await getWidgetConfig(props.widgetInfo.widgetId)
          : undefined;
        props.renderWidget(await getThemedWidget(widgetName, configGroupId));
      } catch (error) {
        console.error(`[WidgetTaskHandler] Failed to render ${widgetName}:`, error);
        props.renderWidget({
          light: <WidgetUnavailable colors={getWidgetColors('light')} />,
          dark: <WidgetUnavailable colors={getWidgetColors('dark')} />,
        });
      }
      break;
    }

    case 'WIDGET_DELETED':
      break;

    case 'WIDGET_CLICK':
      break;

    default:
      break;
  }
}

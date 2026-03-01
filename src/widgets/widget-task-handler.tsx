import React from 'react';
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

export async function getThemedWidget(
  widgetName: string,
  configGroupId?: number
): Promise<React.ReactElement | { light: React.ReactElement; dark: React.ReactElement }> {
  const { primaryColor, themeMode } = await getThemeSettings();
  const lightColors = getWidgetColors('light', primaryColor);
  const darkColors = getWidgetColors('dark', primaryColor);

  const getElement = (light: React.ReactElement, dark: React.ReactElement) => {
    if (themeMode === 'light') return light;
    if (themeMode === 'dark') return dark;
    return { light, dark };
  };

  switch (widgetName) {
    case 'Reminders': {
      const tasks = await getReminders(10);
      return getElement(
        <RemindersWidget tasks={tasks} colors={lightColors} />,
        <RemindersWidget tasks={tasks} colors={darkColors} />
      );
    }

    case 'RecentTasks': {
      const tasks = await getRecentTasks(10);
      return getElement(
        <RecentTasksWidget tasks={tasks} colors={lightColors} />,
        <RecentTasksWidget tasks={tasks} colors={darkColors} />
      );
    }

    case 'RecentMindMaps': {
      const tasks = await getRecentByGroupName('Mapas Mentais', 10);
      return getElement(
        <RecentMindMapsWidget tasks={tasks} colors={lightColors} />,
        <RecentMindMapsWidget tasks={tasks} colors={darkColors} />
      );
    }

    case 'RecentFlashcards': {
      const tasks = await getRecentByGroupName('Flashcards', 10);
      return getElement(
        <RecentFlashcardsWidget tasks={tasks} colors={lightColors} />,
        <RecentFlashcardsWidget tasks={tasks} colors={darkColors} />
      );
    }

    case 'GroupWidget': {
      const getGroupElement = (group: any, tasks: any[]) => getElement(
        <GroupWidget group={group} tasks={tasks} colors={lightColors} />,
        <GroupWidget group={group} tasks={tasks} colors={darkColors} />
      );

      if (configGroupId) {
        const group = await getGroupById(configGroupId);
        if (group) {
          const tasks = await getRecentByGroup(group.id, 10);
          return getGroupElement(group, tasks);
        }
      }
      
      const groups = await getAllWidgetGroups();
      if (groups.length > 0) {
        const group = groups[0]!;
        const tasks = await getRecentByGroup(group.id, 10);
        return getGroupElement(group, tasks);
      } else {
        return getElement(
          <RecentTasksWidget tasks={[]} colors={lightColors} />,
          <RecentTasksWidget tasks={[]} colors={darkColors} />
        );
      }
    }

    default:
      return <RecentTasksWidget tasks={[]} colors={lightColors} />;
  }
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
      const configuration = (props.widgetInfo as any).configuration;
      const widgetProps = (props.widgetInfo as any).props;
      let configGroupId = (configuration?.groupId || widgetProps?.groupId) as number | undefined;
      
      if (!configGroupId) {
        const storedGroupId = await getWidgetConfig(props.widgetInfo.widgetId);
        if (storedGroupId) {
          configGroupId = storedGroupId;
        }
      }

      console.log(`[WidgetTaskHandler] Action: ${props.widgetAction}, Widget: ${widgetName}`);
      console.log(`[WidgetTaskHandler] GroupId (props): ${configuration?.groupId || widgetProps?.groupId}`);
      console.log(`[WidgetTaskHandler] GroupId (final): ${configGroupId}`);
      
      const widgetElement = await getThemedWidget(widgetName, configGroupId);
      props.renderWidget(widgetElement);
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

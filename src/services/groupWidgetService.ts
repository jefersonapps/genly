import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

interface GroupWidgetsModule {
  requestGroupWidget(groupId: number, groupName: string): Promise<boolean>;
  getGroupId(widgetId: number): Promise<number>;
}
const native = Platform.OS === 'android' ? requireOptionalNativeModule<GroupWidgetsModule>('GenlyWidgets') : null;

/** True means the launcher accepted the request, not that the user confirmed it. */
export async function requestGroupWidget(groupId: number, groupName: string): Promise<boolean> {
  if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new Error('Invalid group ID');
  if (!native) return false;
  return native.requestGroupWidget(groupId, groupName);
}

export async function getPinnedWidgetGroupId(widgetId: number): Promise<number | undefined> {
  if (!native) return undefined;
  const id = await native.getGroupId(widgetId);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

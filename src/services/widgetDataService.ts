import { asc, desc, eq, inArray, isNotNull, isNull, notInArray, or } from "drizzle-orm";
import { db } from "../db/client";
import { groups, settings, tasks, type Group } from "../db/schema";
import type { WidgetTask } from '../widgets/types';

const widgetTaskColumns = {
  id: tasks.id,
  title: tasks.title,
  deliveryDate: tasks.deliveryDate,
  deliveryTime: tasks.deliveryTime,
};

// ─── Recent Tasks ─────────────────────────────────────
export async function getRecentTasks(limit: number = 10): Promise<WidgetTask[]> {
  const excludedGroupNames = ["Mapas Mentais", "Flashcards"];

  // Exclude specialized groups in the same query as the note titles.
  const excludedGroups = db
    .select({ id: groups.id })
    .from(groups)
    .where(inArray(groups.name, excludedGroupNames));

  return db
    .select(widgetTaskColumns)
    .from(tasks)
    .where(or(isNull(tasks.groupId), notInArray(tasks.groupId, excludedGroups)))
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
    .all();
}

// ─── Reminders (tasks with delivery date) ─────────────
export async function getReminders(limit: number = 10): Promise<WidgetTask[]> {
  return db
    .select(widgetTaskColumns)
    .from(tasks)
    .where(isNotNull(tasks.deliveryDate))
    .orderBy(asc(tasks.deliveryDate))
    .limit(limit)
    .all();
}

// ─── Recent by Group ──────────────────────────────────
export async function getRecentByGroup(
  groupId: number,
  limit: number = 10
): Promise<WidgetTask[]> {
  return db
    .select(widgetTaskColumns)
    .from(tasks)
    .where(eq(tasks.groupId, groupId))
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
    .all();
}

// ─── Recent by Group Name ─────────────────────────────
export async function getRecentByGroupName(
  groupName: string,
  limit: number = 10
): Promise<WidgetTask[]> {
  const group = await getGroupByName(groupName);
  if (!group) return [];
  return getRecentByGroup(group.id, limit);
}

// ─── Group Lookups ────────────────────────────────────
export async function getGroupByName(
  name: string
): Promise<Group | undefined> {
  const results = await db
    .select()
    .from(groups)
    .where(eq(groups.name, name));
  return results[0];
}

export async function getGroupById(
  id: number
): Promise<Group | undefined> {
  const results = await db
    .select()
    .from(groups)
    .where(eq(groups.id, id));
  return results[0];
}

export async function getAllWidgetGroups(): Promise<Group[]> {
  return db.select().from(groups).orderBy(groups.createdAt).all();
}

// ─── Theme Settings ───────────────────────────────────
// ─── Widget Configuration Persistence ─────────────────
export async function saveWidgetConfig(widgetId: number, groupId: number): Promise<void> {
  const key = `widget_group_${widgetId}`;
  const existing = await db.select().from(settings).where(eq(settings.key, key));
  
  if (existing.length > 0) {
    await db.update(settings).set({ value: groupId.toString() }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value: groupId.toString() });
  }
}

export async function getWidgetConfig(widgetId: number): Promise<number | undefined> {
  const key = `widget_group_${widgetId}`;
  const results = await db.select().from(settings).where(eq(settings.key, key));
  if (results.length > 0) {
    return parseInt(results[0].value, 10);
  }
  // Pinning from inside a group stores the association in Android's widget options.
  // The configuration screen's explicit database choice takes priority on reconfigure.
  const { getPinnedWidgetGroupId } = await import('./groupWidgetService');
  return getPinnedWidgetGroupId(widgetId);
}

export async function deleteWidgetConfig(widgetId: number): Promise<void> {
  await db.delete(settings).where(eq(settings.key, `widget_group_${widgetId}`));
}

export async function getThemeSettings(): Promise<{
  themeMode: string;
  primaryColor: string;
}> {
  const rows = await db.select().from(settings)
    .where(inArray(settings.key, ['theme_mode', 'primary_color'])).all();
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return {
    themeMode: map["theme_mode"] ?? "system",
    primaryColor: map["primary_color"] ?? "#208AEF",
  };
}

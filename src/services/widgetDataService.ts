import { asc, desc, eq, isNotNull, isNull, notInArray, or } from "drizzle-orm";
import { db } from "../db/client";
import { groups, settings, tasks, type Group, type Task } from "../db/schema";

// ─── Recent Tasks ─────────────────────────────────────
export async function getRecentTasks(limit: number = 10): Promise<Task[]> {
  const excludedGroupNames = ["Mapas Mentais", "Flashcards"];

  // Fetch IDs for groups to exclude
  const excludedGroupRows = await db
    .select({ id: groups.id })
    .from(groups)
    .where(or(eq(groups.name, excludedGroupNames[0]), eq(groups.name, excludedGroupNames[1])))
    .all();

  const excludedIds = excludedGroupRows.map((g) => g.id);

  if (excludedIds.length === 0) {
    return db
      .select()
      .from(tasks)
      .orderBy(desc(tasks.updatedAt))
      .limit(limit)
      .all();
  }

  return db
    .select()
    .from(tasks)
    .where(or(isNull(tasks.groupId), notInArray(tasks.groupId, excludedIds)))
    .orderBy(desc(tasks.updatedAt))
    .limit(limit)
    .all();
}

// ─── Reminders (tasks with delivery date) ─────────────
export async function getReminders(limit: number = 10): Promise<Task[]> {
  return db
    .select()
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
): Promise<Task[]> {
  return db
    .select()
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
): Promise<Task[]> {
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
  return undefined;
}

export async function getThemeSettings(): Promise<{
  themeMode: string;
  primaryColor: string;
}> {
  const rows = await db.select().from(settings).all();
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return {
    themeMode: map["theme_mode"] ?? "system",
    primaryColor: map["primary_color"] ?? "#208AEF",
  };
}

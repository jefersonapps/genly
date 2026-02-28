import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { groups, media, tasks, type Group, type Media, type Task } from "../db/schema";
import { NotificationService } from "./notificationService";

// ─── Group Operations ─────────────────────────────────

export async function getAllGroups(): Promise<Group[]> {
  return db.select().from(groups).orderBy(groups.createdAt).all();
}

export async function getGroupByName(name: string): Promise<Group | undefined> {
  const results = await db.select().from(groups).where(eq(groups.name, name));
  return results[0];
}

export async function ensureDefaultGroups(): Promise<void> {
  const allGroups = await getAllGroups();
  
  const mapsGroup = allGroups.find(g => g.name === "Mapas Mentais");
  if (!mapsGroup) {
    await createGroup("Mapas Mentais", "🧠", "#8B5CF6");
  }
  
  const flashcardsGroup = allGroups.find(g => g.name === "Flashcards");
  if (!flashcardsGroup) {
    await createGroup("Flashcards", "🗂️", "#14B8A6");
  }
}

export async function getGroupById(id: number): Promise<Group | undefined> {
  const results = await db.select().from(groups).where(eq(groups.id, id));
  return results[0];
}

export async function createGroup(
  name: string,
  emoji: string = "📁",
  color: string = "#6366f1"
): Promise<Group> {
  const now = new Date().toISOString();
  const result = await db
    .insert(groups)
    .values({ name, emoji, color, createdAt: now })
    .returning();
  return result[0]!;
}

export async function updateGroup(
  id: number,
  data: { name?: string; emoji?: string; color?: string }
): Promise<void> {
  await db.update(groups).set(data).where(eq(groups.id, id));
}

export async function deleteGroup(id: number): Promise<void> {
  // We should also nullify the groupId in tasks associated with this group
  // Drizzle handles this via `onDelete: "set null"` in the schema references if supported by backend,
  // but to be safe and explicit in SQLite:
  await db.update(tasks).set({ groupId: null }).where(eq(tasks.groupId, id));
  await db.delete(groups).where(eq(groups.id, id));
}

// ─── Task Operations ──────────────────────────────────

export async function getAllTasks(): Promise<Task[]> {
  return db.select().from(tasks).orderBy(tasks.updatedAt).all().reverse();
}

export async function getTasksByGroupId(groupId: number): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.groupId, groupId)).orderBy(tasks.updatedAt).all().reverse();
}

export async function getTaskById(id: number): Promise<Task | undefined> {
  const results = await db.select().from(tasks).where(eq(tasks.id, id));
  return results[0];
}

export async function createTask(
  title: string,
  content: string = "",
  groupId: number | null = null,
  deliveryDate: string | null = null,
  deliveryTime: string | null = null
): Promise<Task> {
  const now = new Date().toISOString();
  const result = await db
    .insert(tasks)
    .values({ title, content, groupId, deliveryDate, deliveryTime, createdAt: now, updatedAt: now })
    .returning();
  
  const newTask = result[0]!;

  if (deliveryDate && deliveryTime) {
    const reminderDate = new Date(`${deliveryDate}T${deliveryTime}`);
    await NotificationService.scheduleReminder(newTask.id, newTask.title, "Lembrete de nota", reminderDate);
  }

  return newTask;
}

export async function updateTask(
  id: number,
  data: { title?: string; content?: string, groupId?: number | null, deliveryDate?: string | null, deliveryTime?: string | null },
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(tasks)
    .set({ ...data, updatedAt: now })
    .where(eq(tasks.id, id));

  // If delivery info changed, update notification
  if (data.deliveryDate !== undefined || data.deliveryTime !== undefined || data.title !== undefined) {
    const task = await getTaskById(id);
    if (task) {
      if (task.deliveryDate && task.deliveryTime) {
        const reminderDate = new Date(`${task.deliveryDate}T${task.deliveryTime}`);
        await NotificationService.scheduleReminder(task.id, task.title, "Lembrete de nota", reminderDate);
      } else {
        await NotificationService.cancelReminder(id);
      }
    }
  }
}

export async function bulkUpdateTasksGroup(taskIds: number[], groupId: number | null): Promise<void> {
  const now = new Date().toISOString();
  await Promise.all(
    taskIds.map(id => 
      db.update(tasks)
        .set({ groupId, updatedAt: now })
        .where(eq(tasks.id, id))
    )
  );
}

export async function deleteTask(id: number): Promise<void> {
  // Media entries cascade-deleted via foreign key
  await NotificationService.cancelReminder(id);
  await db.delete(tasks).where(eq(tasks.id, id));
}

// ─── Media Operations ─────────────────────────────────

export async function getMediaForTask(taskId: number): Promise<Media[]> {
  return db.select().from(media).where(eq(media.taskId, taskId)).all();
}

export async function addMedia(
  taskId: number,
  uri: string,
  type: "image" | "latex" | "pdf",
  latexSource?: string,
  latexStyle?: string,
  thumbnailUri?: string
): Promise<Media> {
  const now = new Date().toISOString();
  const result = await db
    .insert(media)
    .values({ taskId, uri, type, latexSource, latexStyle, thumbnailUri, createdAt: now })
    .returning();
  return result[0]!;
}

export async function updateMedia(
  id: number,
  data: { uri?: string; latexSource?: string; latexStyle?: string },
): Promise<void> {
  await db.update(media).set(data).where(eq(media.id, id));
}

export async function deleteMedia(id: number): Promise<void> {
  await db.delete(media).where(eq(media.id, id));
}

export async function deleteAllMediaForTask(taskId: number): Promise<void> {
  await db.delete(media).where(eq(media.taskId, taskId));
}

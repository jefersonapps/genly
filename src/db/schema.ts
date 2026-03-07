import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ─── Groups ───────────────────────────────────────────
export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji").default("📁"),
  color: text("color").default("#6366f1"),
  createdAt: text("created_at").notNull(),
});

// ─── Tasks ────────────────────────────────────────────
export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").references(() => groups.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  content: text("content").default(""),
  deliveryDate: text("delivery_date"),
  deliveryTime: text("delivery_time"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  completed: integer("completed").notNull().default(0),
});

// ─── Media (images + latex equations) ─────────────────
export const media = sqliteTable("media", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  uri: text("uri").notNull(),
  type: text("type").notNull(), // image, latex, pdf
  latexSource: text("latex_source"),
  latexStyle: text("latex_style"),
  thumbnailUri: text("thumbnail_uri"),
  createdAt: text("created_at").notNull(),
});

// ─── Settings (key-value) ─────────────────────────────
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

// ─── Transactions (finance) ──────────────────────────
export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").default(""),
  amount: integer("amount").notNull().default(0), // centavos
  type: text("type").notNull(), // "income" | "expense"
  isAmountUndefined: integer("is_amount_undefined").notNull().default(0), // 0 = false, 1 = true
  createdAt: text("created_at").notNull(),
});

// ─── Types ────────────────────────────────────────────
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

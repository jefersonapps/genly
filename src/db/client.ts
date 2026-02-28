import * as SQLite from "expo-sqlite";
import { drizzle } from "drizzle-orm/expo-sqlite";
import * as schema from "./schema";

const DATABASE_NAME = "genly.db";

const expo = SQLite.openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true,
});

// Enable WAL mode for better performance
expo.execSync("PRAGMA journal_mode = WAL;");
expo.execSync("PRAGMA foreign_keys = ON;");

export const db = drizzle(expo, { schema });

export type Database = typeof db;

import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { settings } from "../db/schema";

export type SettingKey =
  | "theme_mode"
  | "primary_color"
  | "profile_name"
  | "profile_image"
  | "security_enabled"
  | "gemini_api_key"
  | "openai_api_key"
  | "gemini_model"
  | "openai_model"
  | "active_model"
  | "latex_style"
  | "finance_balance";

const DEFAULTS: Record<SettingKey, string> = {
  theme_mode: "system",
  primary_color: "#208AEF",
  profile_name: "",
  profile_image: "",
  security_enabled: "0",
  gemini_api_key: "",
  openai_api_key: "",
  gemini_model: "gemini-1.5-flash",
  openai_model: "gpt-4o-mini",
  active_model: "gemini",
  latex_style: "",
  finance_balance: "0",
};

export async function getSetting(key: SettingKey): Promise<string> {
  const results = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key));
  return results[0]?.value ?? DEFAULTS[key];
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key));

  if (existing.length > 0) {
    await db.update(settings).set({ value }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value });
  }
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settings).all();
  const result: Record<string, string> = { ...DEFAULTS };
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

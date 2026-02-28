import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { unzip, zip } from "react-native-zip-archive";
import { db } from "../db/client";
import { media as mediaTable, settings, tasks, transactions, type Media, type Setting, type Task, type Transaction } from "../db/schema";
import { copyFile, ensureDir, ensureDirectories, getCacheDir, getMediaDir, writeBase64ToFile } from "../utils/file";

// Helper to strip 'file://' prefix for native libraries that expect raw paths
const stripFilePrefix = (path: string) => path.replace(/^file:\/\//, "");


// Define the backup metadata structure (version 2 uses ZIP)
interface BackupMetadata {
  version: 2;
  exportedAt: string;
  tasks: Array<Task & {
    media: Media[];
  }>;
  settings: Setting[];
  transactions?: Transaction[];
}

// Legacy structure for version 1 (JSON with base64)
interface LegacyBackupData {
  version: 1;
  exportedAt: string;
  tasks: Array<{
    id: number;
    title: string;
    content: string | null;
    createdAt: string;
    updatedAt: string;
    media: Array<{
      id: number;
      uri: string;
      type: "image" | "latex" | string;
      latexSource: string | null;
      latexStyle: string | null;
      createdAt: string;
      base64Data?: string;
    }>;
  }>;
  settings: Array<{ key: string; value: string }>;
}

/** Export all data to a ZIP file and share it */
export async function exportBackup(): Promise<string> {
  const allTasks = await db.select().from(tasks).all();
  const allMedia = await db.select().from(mediaTable).all();
  const allSettings = await db.select().from(settings).all();
  const allTransactions = await db.select().from(transactions).all();

  const tasksWithMedia = allTasks.map((task) => {
    const taskMedia = allMedia.filter((m) => m.taskId === task.id);
    return { ...task, media: taskMedia };
  });

  const metadata: BackupMetadata = {
    version: 2,
    exportedAt: new Date().toISOString(),
    tasks: tasksWithMedia,
    settings: allSettings,
    transactions: allTransactions,
  };

  const timestamp = Date.now();
  const tempDir = `${getCacheDir()}backup_temp_${timestamp}/`;
  const mediaTempDir = `${tempDir}media/`;
  
  await ensureDir(mediaTempDir);

  // Write metadata
  await FileSystem.writeAsStringAsync(`${tempDir}data.json`, JSON.stringify(metadata, null, 2));

  // Copy media files (main and thumbnails)
  const mediaToCopy = new Set<string>();
  for (const m of allMedia) {
    if (m.uri) mediaToCopy.add(m.uri);
    if (m.thumbnailUri) mediaToCopy.add(m.thumbnailUri);
  }

  for (const fileUri of mediaToCopy) {
    try {
      const filename = fileUri.split("/").pop();
      if (filename) {
        const destUri = `${mediaTempDir}${filename}`;
        const info = await FileSystem.getInfoAsync(fileUri);
        if (info.exists) {
          await copyFile(fileUri, destUri);
        }
      }
    } catch (e) {
      console.error(`Failed to copy media ${fileUri}:`, e);
    }
  }

  const zipPath = `${getCacheDir()}genly_backup_${timestamp}.zip`;
  
  console.log(`[Backup] Zipping from ${tempDir} to ${zipPath}`);
  
  let finalZipPath: string;
  try {
    // Some native libs don't like trailing slashes on directories
    const sourcePath = stripFilePrefix(tempDir).replace(/\/$/, "");
    const targetPath = stripFilePrefix(zipPath);
    
    console.log(`[Backup] Calling zip: source=${sourcePath}, target=${targetPath}`);
    finalZipPath = await zip(sourcePath, targetPath);
    console.log(`[Backup] Zip success: ${finalZipPath}`);
    
    // Ensure the path has file:// prefix for Sharing
    if (!finalZipPath.startsWith("file://")) {
      finalZipPath = `file://${finalZipPath}`;
    }
  } catch (err) {
    console.error(`[Backup] Zip failed:`, err);
    throw new Error(`Falha ao criar arquivo ZIP do backup: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Cleanup temp dir
  await FileSystem.deleteAsync(tempDir, { idempotent: true });

  return finalZipPath;
}

export interface BackupPreview {
  version: number;
  exportedAt: string;
  taskCount: number;
  mediaCount: number;
  settingsCount: number;
}

/** Validate a backup file (zip or json) and return a preview */
export async function validateBackupFile(fileUri: string): Promise<BackupPreview> {
  const isZip = fileUri.toLowerCase().endsWith(".zip");
  
  if (isZip) {
    const timestamp = Date.now();
    const tempUnzipDir = `${getCacheDir()}unzip_preview_${timestamp}/`;
    await ensureDir(tempUnzipDir);
    
    try {
      console.log(`[Backup] Unzipping preview from ${fileUri} to ${tempUnzipDir}`);
      await unzip(stripFilePrefix(fileUri), stripFilePrefix(tempUnzipDir));
      const metadataStr = await FileSystem.readAsStringAsync(`${tempUnzipDir}data.json`);
      const metadata: BackupMetadata = JSON.parse(metadataStr);
      
      const mediaCount = metadata.tasks.reduce((sum, t) => sum + t.media.length, 0);
      
      return {
        version: metadata.version,
        exportedAt: metadata.exportedAt,
        taskCount: metadata.tasks.length,
        mediaCount,
        settingsCount: metadata.settings.length,
      };
    } finally {
      await FileSystem.deleteAsync(tempUnzipDir, { idempotent: true });
    }
  } else {
    // Legacy JSON validation
    const content = await FileSystem.readAsStringAsync(fileUri);
    const backup: LegacyBackupData = JSON.parse(content);
    
    if (backup.version !== 1) throw new Error("Versão de backup JSON não suportada");

    const mediaCount = backup.tasks.reduce((sum, t) => sum + t.media.length, 0);

    return {
      version: 1,
      exportedAt: backup.exportedAt,
      taskCount: backup.tasks.length,
      mediaCount,
      settingsCount: backup.settings.length,
    };
  }
}

/** Import data from a backup file */
export async function importBackup(fileUri?: string): Promise<void> {
  let uri = fileUri;

  if (!uri) {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/zip", "application/json"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    uri = result.assets[0].uri;
  }

  const isZip = uri.toLowerCase().endsWith(".zip");

  if (isZip) {
    const timestamp = Date.now();
    const tempUnzipDir = `${getCacheDir()}unzip_import_${timestamp}/`;
    await ensureDir(tempUnzipDir);

    try {
      console.log(`[Backup] Unzipping import from ${uri} to ${tempUnzipDir}`);
      await unzip(stripFilePrefix(uri), stripFilePrefix(tempUnzipDir));
      const metadataStr = await FileSystem.readAsStringAsync(`${tempUnzipDir}data.json`);
      const metadata: BackupMetadata = JSON.parse(metadataStr);

      await restoreData(metadata, `${tempUnzipDir}media/`);
    } finally {
      await FileSystem.deleteAsync(tempUnzipDir, { idempotent: true });
    }
  } else {
    // Legacy JSON import
    const content = await FileSystem.readAsStringAsync(uri);
    const backup: LegacyBackupData = JSON.parse(content);
    await restoreLegacyData(backup);
  }
}

/** Restore data from version 2 (ZIP) */
async function restoreData(metadata: BackupMetadata, mediaSourceDir: string) {
  await ensureDirectories();

  // Clear existing data
  await db.delete(mediaTable);
  await db.delete(tasks);
  await db.delete(settings);
  await db.delete(transactions);

  // Restore settings
  for (const setting of metadata.settings) {
    await db.insert(settings).values(setting).onConflictDoUpdate({
      target: settings.key,
      set: { value: setting.value }
    });
  }

  // Restore tasks and media
  for (const task of metadata.tasks) {
    const [insertedTask] = await db.insert(tasks).values({
      groupId: task.groupId,
      title: task.title,
      content: task.content,
      deliveryDate: task.deliveryDate,
      deliveryTime: task.deliveryTime,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }).returning();

    if (!insertedTask) continue;

    for (const m of task.media) {
      const filename = m.uri.split("/").pop();
      if (!filename) continue;

      const sourceUri = `${mediaSourceDir}${filename}`;
      // Use a timestamp to avoid same-filename-from-different-tasks collisions during restore
      const uniqueFilename = `restored_${Date.now()}_${filename}`;
      const destUri = `${getMediaDir()}${uniqueFilename}`;

      const info = await FileSystem.getInfoAsync(sourceUri);
      if (info.exists) {
        await copyFile(sourceUri, destUri);
      }

      // Handle thumbnail restoration
      let restoredThumbnailUri = m.thumbnailUri;
      if (m.thumbnailUri) {
        const thumbFilename = m.thumbnailUri.split("/").pop();
        if (thumbFilename) {
          const thumbSourceUri = `${mediaSourceDir}${thumbFilename}`;
          const thumbDestUri = `${getMediaDir()}restored_${Date.now()}_${thumbFilename}`;
          const thumbInfo = await FileSystem.getInfoAsync(thumbSourceUri);
          if (thumbInfo.exists) {
            await copyFile(thumbSourceUri, thumbDestUri);
            restoredThumbnailUri = thumbDestUri;
          }
        }
      }

      await db.insert(mediaTable).values({
        taskId: insertedTask.id,
        uri: destUri,
        type: m.type,
        latexSource: m.latexSource,
        latexStyle: m.latexStyle,
        thumbnailUri: restoredThumbnailUri,
        createdAt: m.createdAt,
      });
    }
  }

  // Restore transactions (if present)
  if (metadata.transactions && metadata.transactions.length > 0) {
    for (const t of metadata.transactions) {
      await db.insert(transactions).values({
        title: t.title,
        description: t.description,
        amount: t.amount,
        type: t.type,
        isAmountUndefined: t.isAmountUndefined,
        createdAt: t.createdAt,
      });
    }
  }
}

/** Restore data from legacy version 1 (JSON) */
async function restoreLegacyData(backup: LegacyBackupData) {
  await ensureDirectories();

  await db.delete(mediaTable);
  await db.delete(tasks);
  await db.delete(settings);

  for (const setting of backup.settings) {
    await db.insert(settings).values(setting).onConflictDoUpdate({
      target: settings.key,
      set: { value: setting.value }
    });
  }

  for (const task of backup.tasks) {
    const [insertedTask] = await db.insert(tasks).values({
      title: task.title,
      content: task.content,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }).returning();

    if (!insertedTask) continue;

    for (const m of task.media) {
      let newUri = m.uri;
      if (m.base64Data) {
        const ext = m.type === "latex" ? "png" : m.uri.split(".").pop() || "jpg";
        const filename = `restored_${Date.now()}_${m.id}.${ext}`;
        newUri = await writeBase64ToFile(m.base64Data, filename);
      }

      await db.insert(mediaTable).values({
        taskId: insertedTask.id,
        uri: newUri,
        type: m.type as any, // Cast because old backup might have strings
        latexSource: m.latexSource,
        latexStyle: m.latexStyle,
        createdAt: m.createdAt,
      });
    }
  }
}

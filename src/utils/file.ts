import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

const MEDIA_DIR = (FileSystem.documentDirectory || "") + "media/";
const PROFILE_DIR = (FileSystem.documentDirectory || "") + "profile/";

/** Ensure a specific directory exists */
export async function ensureDir(dir: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/** Ensure internal directories exist */
export async function ensureDirectories(): Promise<void> {
  const dirs = [MEDIA_DIR, PROFILE_DIR];
  for (const dir of dirs) {
    await ensureDir(dir);
  }
}

/** Copy a file to the internal media directory and return the new URI */
export async function copyToMediaDir(sourceUri: string): Promise<string> {
  await ensureDirectories();
  const filename = `${Date.now()}_${sourceUri.split("/").pop() ?? "file"}`;
  const destUri = MEDIA_DIR + filename;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

/** Copy a file to the internal profile directory and return the new URI */
export async function copyToProfileDir(sourceUri: string): Promise<string> {
  await ensureDirectories();
  const filename = `profile_avatar_${Date.now()}.jpg`;
  const destUri = PROFILE_DIR + filename;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

/** Delete a file at the given URI */
export async function deleteFile(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}

/** Pick images from the gallery */
export async function pickImages(): Promise<string[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: true,
    quality: 0.85,
  });

  if (result.canceled || !result.assets) return [];
  return result.assets.map((asset) => asset.uri);
}

/** Get the media directory path */
export function getMediaDir(): string {
  return MEDIA_DIR;
}

/** Get the profile directory path */
export function getProfileDir(): string {
  return PROFILE_DIR;
}

/** Get the cache directory path */
export function getCacheDir(): string {
  return FileSystem.cacheDirectory || "";
}

/** Copy a file */
export async function copyFile(from: string, to: string): Promise<void> {
  await FileSystem.copyAsync({ from, to });
}

/** Move a file */
export async function moveFile(from: string, to: string): Promise<void> {
  await FileSystem.moveAsync({ from, to });
}

/** Read a file as a base64 string */
export async function readAsBase64(uri: string): Promise<string> {
  return await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

/** Write a base64 string to a file */
export async function writeBase64ToFile(
  base64: string,
  filename: string,
): Promise<string> {
  await ensureDirectories();
  const destUri = MEDIA_DIR + filename;
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destUri;
}

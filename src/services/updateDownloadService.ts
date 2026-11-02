import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

export interface UpdateDownload {
  id: string;
  version: string;
  downloadUrl: string;
  releaseNotes: string;
  expectedBytes: number;
  receivedBytes: number;
  totalBytes: number;
  status: 'pending' | 'running' | 'paused' | 'complete' | 'failed' | 'missing';
  reason: number;
}
interface UpdateDownloadModule {
  getDownload(): Promise<UpdateDownload | null>;
  startDownload(version: string, url: string, notes: string, size: number): Promise<UpdateDownload>;
  cancelDownload(): Promise<void>;
  installDownload(): Promise<'permission' | 'opened'>;
}
const native = Platform.OS === 'android' ? requireOptionalNativeModule<UpdateDownloadModule>('GenlyUpdates') : null;
const required = () => {
  if (!native) throw new Error('Update download service unavailable');
  return native;
};
export const updateDownloadService = {
  getDownload: () => native?.getDownload() ?? Promise.resolve(null),
  startDownload: (version: string, url: string, notes: string, size: number) => required().startDownload(version, url, notes, size),
  cancelDownload: () => native?.cancelDownload() ?? Promise.resolve(),
  installDownload: () => required().installDownload(),
};

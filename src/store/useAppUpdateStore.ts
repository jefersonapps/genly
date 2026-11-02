import { updateErrorMessage } from "@/utils/updateErrors";
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { updateDownloadService, type UpdateDownload } from '@/services/updateDownloadService';
import { isNewerAppVersion, updateDownloadFailure, updateDownloadProgress } from '@/utils/updateDownload';
import { create } from 'zustand';

const GITHUB_REPO = 'jefersonapps/genly';

export interface UpdateInfo {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
  sizeBytes?: number;
}

interface AppUpdateState {
  hasUpdate: boolean;
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number | null;
  downloadInfo: UpdateInfo | null;
  downloadStatus: 'idle' | UpdateDownload['status'];
  downloadedBytes: number;
  downloadTotalBytes: number;
  downloadReason: number;
  isRestoringDownload: boolean;
  isInstalling: boolean;
  installMessage: string | null;
  downloadError: string | null;
  checkError: string | null;

  checkForUpdates: (options?: { silent?: boolean }) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  resetError: () => void;
  refreshDownload: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  installDownloadedUpdate: () => Promise<void>;
}

let pendingCheck: Promise<void> | null = null;
let reportCheckError = false;
let pendingRefresh: Promise<void> | null = null;
let downloadGeneration = 0;
let pendingStart: Promise<UpdateDownload> | null = null;
let cancelingDownload = false;

const idleDownload = {
  isDownloading: false, downloadProgress: null, downloadInfo: null, downloadStatus: 'idle',
  downloadedBytes: 0, downloadTotalBytes: 0, downloadReason: 0, installMessage: null,
} as const;

function snapshotState(snapshot: UpdateDownload): Partial<AppUpdateState> {
  const complete = snapshot.status === 'complete';
  const total = snapshot.totalBytes > 0 ? snapshot.totalBytes : snapshot.expectedBytes;
  return {
    downloadInfo: { version: snapshot.version, downloadUrl: snapshot.downloadUrl, releaseNotes: snapshot.releaseNotes, sizeBytes: snapshot.expectedBytes },
    isDownloading: ['pending', 'running', 'paused'].includes(snapshot.status),
    downloadStatus: snapshot.status,
    downloadedBytes: Math.max(0, snapshot.receivedBytes),
    downloadTotalBytes: Math.max(0, total),
    downloadProgress: updateDownloadProgress(snapshot.receivedBytes, total, complete),
    downloadReason: snapshot.reason,
    downloadError: snapshot.status === 'failed' || snapshot.status === 'missing' ? updateDownloadFailure(snapshot.reason) : null,
    isRestoringDownload: false,
  };
}

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  hasUpdate: false,
  updateInfo: null,
  isChecking: false,
  ...idleDownload,
  isRestoringDownload: Platform.OS === 'android',
  isInstalling: false,
  downloadError: null,
  checkError: null,

  resetError: () => set({ downloadError: null, checkError: null }),

  checkForUpdates: async (options) => {
    if (Platform.OS !== 'android') return;
    // A visible update screen can join the startup request and receive its error.
    reportCheckError = reportCheckError || !options?.silent;
    if (pendingCheck) return pendingCheck;
    set({ isChecking: true, checkError: null });
    pendingCheck = (async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);

        if (!response.ok) {
          if (response.status === 404) {
             // No releases found yet
             set({ hasUpdate: false, updateInfo: null });
             return;
          }
          throw new Error('Falha ao buscar atualizações do GitHub');
        }

        const data = await response.json();
        const latestVersion = data.tag_name;
        const currentVersion = Constants.expoConfig?.version || require('../../app.json').expo.version;

        if (isNewerAppVersion(latestVersion, currentVersion)) {
          const apkAsset = data.assets?.find((asset: any) => asset.name.endsWith('.apk'));

          if (apkAsset) {
            set({
              hasUpdate: true,
              updateInfo: {
                version: latestVersion,
                downloadUrl: apkAsset.browser_download_url,
                releaseNotes: data.body || '',
                sizeBytes: Number(apkAsset.size) || 0,
              },
            });
            return;
          }
        }

        set({ hasUpdate: false, updateInfo: null });
      } catch (error: unknown) {
        // Offline startup is expected: no global error state, toast or console error.
        set({ checkError: reportCheckError ? updateErrorMessage(error, 'check') : null });
      } finally {
        set({ isChecking: false });
      }
    })();
    try { await pendingCheck; }
    finally { pendingCheck = null; reportCheckError = false; }
  },

  refreshDownload: async () => {
    if (Platform.OS !== 'android') { set({ isRestoringDownload: false }); return; }
    if (pendingRefresh) return pendingRefresh;
    const generation = downloadGeneration;
    pendingRefresh = (async () => {
      try {
        const snapshot = await updateDownloadService.getDownload();
        if (generation !== downloadGeneration) return;
        if (!snapshot) { set({ ...idleDownload, isRestoringDownload: false }); return; }
        const currentVersion = Constants.expoConfig?.version || require('../../app.json').expo.version;
        // After installation, remove only this module's old transfer and APK.
        if (!isNewerAppVersion(snapshot.version, currentVersion)) {
          await updateDownloadService.cancelDownload();
          if (generation === downloadGeneration) set({ ...idleDownload, isRestoringDownload: false });
          return;
        }
        set({ ...snapshotState(snapshot), hasUpdate: true,
          updateInfo: get().updateInfo || { version: snapshot.version, downloadUrl: snapshot.downloadUrl, releaseNotes: snapshot.releaseNotes, sizeBytes: snapshot.expectedBytes } });
      } catch {
        // A temporary query failure must not reset an active transfer or show a startup modal.
        if (generation === downloadGeneration) set({ isRestoringDownload: false });
      }
    })();
    try { await pendingRefresh; } finally { pendingRefresh = null; }
  },

  downloadAndInstall: async () => {
    const { updateInfo, isDownloading } = get();
    if (!updateInfo?.downloadUrl || isDownloading || cancelingDownload || Platform.OS !== 'android') return;
    if (get().downloadStatus === 'complete') { await get().installDownloadedUpdate(); return; }
    const generation = ++downloadGeneration;
    set({ isDownloading: true, downloadStatus: 'pending', downloadProgress: null,
      downloadInfo: updateInfo, downloadedBytes: 0, downloadTotalBytes: updateInfo.sizeBytes || 0,
      downloadError: null, checkError: null, installMessage: null });
    try {
      pendingStart = updateDownloadService.startDownload(updateInfo.version, updateInfo.downloadUrl,
        updateInfo.releaseNotes, updateInfo.sizeBytes || 0);
      const snapshot = await pendingStart;
      if (generation === downloadGeneration) set(snapshotState(snapshot));
    } catch (error) {
      if (generation === downloadGeneration) set({ isDownloading: false, isRestoringDownload: false, downloadStatus: 'failed', downloadError: updateErrorMessage(error, 'download') });
    } finally { pendingStart = null; }
  },

  cancelDownload: async () => {
    if (cancelingDownload) return;
    cancelingDownload = true;
    ++downloadGeneration;
    try {
      // Cancel after an enqueue already in flight has saved its native ID.
      await pendingStart?.catch(() => {});
      await updateDownloadService.cancelDownload();
      set({ ...idleDownload, isRestoringDownload: false, downloadError: null });
    } catch {
      set({ downloadError: 'Não foi possível cancelar o download. Tente novamente.' });
    } finally { cancelingDownload = false; }
  },

  installDownloadedUpdate: async () => {
    if (get().downloadStatus !== 'complete' || get().isInstalling) return;
    set({ isInstalling: true, downloadError: null, installMessage: null });
    try {
      const result = await updateDownloadService.installDownload();
      if (result === 'permission') set({ installMessage: 'Permita a instalação de apps pelo Genly e, ao voltar, toque em Instalar atualização.' });
    } catch (error) {
      set({ downloadError: updateErrorMessage(error, 'install') });
    } finally { set({ isInstalling: false }); }
  },
}));

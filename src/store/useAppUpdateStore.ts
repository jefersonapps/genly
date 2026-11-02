import { updateErrorMessage } from "@/utils/updateErrors";
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { create } from 'zustand';

const GITHUB_REPO = 'jefersonapps/genly';

export interface UpdateInfo {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
}

interface AppUpdateState {
  hasUpdate: boolean;
  updateInfo: UpdateInfo | null;
  isChecking: boolean;
  isDownloading: boolean;
  downloadProgress: number;
  downloadError: string | null;
  checkError: string | null;

  checkForUpdates: (options?: { silent?: boolean }) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  resetError: () => void;
}

let pendingCheck: Promise<void> | null = null;
let reportCheckError = false;

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  hasUpdate: false,
  updateInfo: null,
  isChecking: false,
  isDownloading: false,
  downloadProgress: 0,
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

        const isNewerVersion = (latest: string | undefined, current: string | undefined) => {
          if (!latest || !current) return false;
          const lParts = latest.replace(/^v/, '').split('.').map(Number);
          const cParts = current.replace(/^v/, '').split('.').map(Number);

          for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
            const l = lParts[i] || 0;
            const c = cParts[i] || 0;
            if (l > c) return true;
            if (l < c) return false;
          }
          return false;
        };

        if (isNewerVersion(latestVersion, currentVersion)) {
          const apkAsset = data.assets?.find((asset: any) => asset.name.endsWith('.apk'));

          if (apkAsset) {
            set({
              hasUpdate: true,
              updateInfo: {
                version: latestVersion,
                downloadUrl: apkAsset.browser_download_url,
                releaseNotes: data.body || '',
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

  downloadAndInstall: async () => {
    const { updateInfo, isDownloading } = get();

    if (!updateInfo?.downloadUrl || isDownloading || Platform.OS !== 'android') return;

    set({ isDownloading: true, downloadProgress: 0, downloadError: null, checkError: null });

    const dirs = ReactNativeBlobUtil.fs.dirs;
    const downloadDir = Platform.OS === 'android' ? dirs.DownloadDir : dirs.DocumentDir;

    // Create a precise clean path in DownloadDir
    const apkPath = `${downloadDir}/Genly_Update_${updateInfo.version.replace(/[^a-zA-Z0-9.-]/g, '')}.apk`;

    let operation: 'download' | 'install' = 'download';
    try {
      // Remove all previous Genly Update APKs to free up space
      try {
        const files = await ReactNativeBlobUtil.fs.ls(downloadDir);
        for (const file of files) {
          if (file.startsWith('Genly_Update_') && file.endsWith('.apk')) {
            const oldApkPath = `${downloadDir}/${file}`;
            await ReactNativeBlobUtil.fs.unlink(oldApkPath);
          }
        }
      } catch (cleanupError) {
        console.warn("Failed to cleanup old APKs:", cleanupError);
      }

      // Baixar usando ReactNativeBlobUtil
      const result = await ReactNativeBlobUtil.config({
        path: apkPath,
        fileCache: true,
      })
      .fetch('GET', updateInfo.downloadUrl)
      .progress((received, total) => {
        const percentage = Math.round((Number(received) / Number(total)) * 100);
        set({ downloadProgress: percentage });
      });

      const savedPath = result.path();

      // Aciona a intent nativa de instalação após conclusão do download
      operation = 'install';
      await ReactNativeBlobUtil.android.actionViewIntent(
        savedPath,
        'application/vnd.android.package-archive'
      );

      // Download finalizado com sucesso
      set({ isDownloading: false, downloadProgress: 100 });

    } catch (error: unknown) {
      set({
        isDownloading: false,
        downloadError: updateErrorMessage(error, operation),
      });
    }
  },
}));

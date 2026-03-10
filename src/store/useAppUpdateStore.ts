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

  checkForUpdates: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  resetError: () => void;
}

export const useAppUpdateStore = create<AppUpdateState>((set, get) => ({
  hasUpdate: false,
  updateInfo: null,
  isChecking: false,
  isDownloading: false,
  downloadProgress: 0,
  downloadError: null,

  resetError: () => set({ downloadError: null }),

  checkForUpdates: async () => {
    if (Platform.OS !== 'android') return;

    set({ isChecking: true, downloadError: null });

    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
      
      if (!response.ok) {
        if (response.status === 404) {
           // No releases found yet
           set({ isChecking: false, hasUpdate: false });
           return;
        }
        throw new Error('Falha ao buscar atualizações do GitHub');
      }

      const data = await response.json();
      const latestVersion = data.tag_name;
      const currentVersion = Constants.expoConfig?.version;

      const normalizeVersion = (v: string | undefined) => v?.replace('v', '');

      if (normalizeVersion(latestVersion) !== normalizeVersion(currentVersion)) {
        const apkAsset = data.assets?.find((asset: any) => asset.name.endsWith('.apk'));
        
        if (apkAsset) {
          set({
            hasUpdate: true,
            updateInfo: {
              version: latestVersion,
              downloadUrl: apkAsset.browser_download_url,
              releaseNotes: data.body || '',
            },
            isChecking: false,
          });
          return;
        }
      }
      
      set({ hasUpdate: false, isChecking: false });
    } catch (error: any) {
      console.error("Erro ao checar atualizações:", error);
      set({ 
          isChecking: false, 
          hasUpdate: false,
          downloadError: error.message || 'Erro ao verificar atualizações.'
      });
    }
  },

  downloadAndInstall: async () => {
    const { updateInfo, isDownloading } = get();
    
    if (!updateInfo?.downloadUrl || isDownloading || Platform.OS !== 'android') return;

    set({ isDownloading: true, downloadProgress: 0, downloadError: null });

    const dirs = ReactNativeBlobUtil.fs.dirs;
    const apkPath = `${dirs.DocumentDir}/genly-update.apk`;

    try {
      // Remover APK antigo se existir
      const exists = await ReactNativeBlobUtil.fs.exists(apkPath);
      if (exists) {
         await ReactNativeBlobUtil.fs.unlink(apkPath);
      }

      const result = await ReactNativeBlobUtil.config({
        path: apkPath,
        fileCache: true,
        addAndroidDownloads: {
          useDownloadManager: true,
          notification: true, // Mostra o download na barra de notificações nativa
          title: 'Baixando Genly',
          description: `Versão ${updateInfo.version}`,
          mime: 'application/vnd.android.package-archive',
          mediaScannable: true,
        }
      })
      .fetch('GET', updateInfo.downloadUrl)
      .progress((received, total) => {
        const percentage = Math.round((Number(received) / Number(total)) * 100);
        set({ downloadProgress: percentage });
      });

      const savedPath = result.path();
      
      // Aciona a intent nativa de instalação
      ReactNativeBlobUtil.android.actionViewIntent(
        savedPath,
        'application/vnd.android.package-archive'
      );

      // Download finalizado com sucesso
      set({ isDownloading: false, downloadProgress: 100 });

    } catch (error: any) {
      console.error("Erro ao baixar ou instalar o APK:", error);
      set({ 
        isDownloading: false, 
        downloadError: error.message || 'Falha ao baixar a atualização.' 
      });
    }
  },
}));

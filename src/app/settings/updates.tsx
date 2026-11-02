import { formatUpdateBytes, updateDownloadWaitingMessage } from "@/utils/updateDownload";
import { Button } from "@/components/ui/Button";
import { useTheme } from "@/providers/ThemeProvider";
import { useAppUpdateStore } from "@/store/useAppUpdateStore";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { AlertCircle, ArrowLeft, CheckCircle, RefreshCw, Smartphone } from "lucide-react-native";
import React, { useEffect } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import Markdown from 'react-native-markdown-renderer';
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UpdatesSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { primaryColor, resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const colors = {
    bg: isDark ? "#0A0A0A" : "#FFFFFF",
    surface: isDark ? "#171717" : "#F5F5F5",
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    border: isDark ? "#262626" : "#E5E5E5",
  };

  const currentVersion = Constants.expoConfig?.version || "1.0.0";

  const hasUpdate = useAppUpdateStore((s) => s.hasUpdate);
  const updateInfo = useAppUpdateStore((s) => s.updateInfo);
  const isChecking = useAppUpdateStore((s) => s.isChecking);
  const isDownloading = useAppUpdateStore((s) => s.isDownloading);
  const downloadProgress = useAppUpdateStore((s) => s.downloadProgress);
  const downloadInfo = useAppUpdateStore((s) => s.downloadInfo);
  const downloadStatus = useAppUpdateStore((s) => s.downloadStatus);
  const downloadedBytes = useAppUpdateStore((s) => s.downloadedBytes);
  const downloadTotalBytes = useAppUpdateStore((s) => s.downloadTotalBytes);
  const downloadReason = useAppUpdateStore((s) => s.downloadReason);
  const isRestoringDownload = useAppUpdateStore((s) => s.isRestoringDownload);
  const isInstalling = useAppUpdateStore((s) => s.isInstalling);
  const installMessage = useAppUpdateStore((s) => s.installMessage);
  const installDownloadedUpdate = useAppUpdateStore((s) => s.installDownloadedUpdate);
  const cancelDownload = useAppUpdateStore((s) => s.cancelDownload);
  const downloadError = useAppUpdateStore((s) => s.downloadError);
  const checkError = useAppUpdateStore((s) => s.checkError);

  const checkForUpdates = useAppUpdateStore((s) => s.checkForUpdates);
  const downloadAndInstall = useAppUpdateStore((s) => s.downloadAndInstall);
  const showCheckError = !downloadError && downloadStatus !== 'complete' && Boolean(checkError);

  useEffect(() => {
    void (async () => {
      await useAppUpdateStore.getState().refreshDownload();
      const state = useAppUpdateStore.getState();
      if (!state.hasUpdate && !state.isDownloading) await state.checkForUpdates();
    })();
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg, paddingTop: insets.top }}>

      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4 py-3"

      >
        <Button variant="icon" onPress={() => router.back()}>
          <Button.Icon icon={<ArrowLeft size={24} color={colors.text} />} />
        </Button>
        <Text className="text-lg font-sans-bold" style={{ color: colors.text }}>Atualizações</Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 60, flexGrow: 1 }}>
        {/* Device Icon Hero */}
        <View className="items-center mb-10 mt-6">
            <View className="h-28 w-28 rounded-full items-center justify-center mb-5" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                <Smartphone size={48} color={primaryColor} />
            </View>
            <Text className="font-sans-bold text-3xl" style={{ color: colors.text }}>Genly</Text>
            <Text className="font-sans text-base mt-2" style={{ color: colors.textSecondary }}>Versão {currentVersion}</Text>
        </View>

        {/* Status Card */}
        <View className="rounded-2xl p-6 border mb-8" style={{ backgroundColor: colors.surface, borderColor: colors.border }}>
            {isRestoringDownload ? (
                <View className="items-center py-6"><ActivityIndicator color={primaryColor} /><Text className="font-sans text-sm mt-3" style={{ color: colors.textSecondary }}>Recuperando download...</Text></View>
            ) : isDownloading ? (
                <View className="py-2">
                    <Text className="font-sans-bold text-xl mb-3" style={{ color: colors.text }}>
                        {downloadStatus === 'paused' ? 'Download em espera' : 'Baixando atualização...'}
                    </Text>
                    <Text className="font-sans mb-6 text-base" style={{ color: colors.textSecondary }}>Versão {downloadInfo?.version}</Text>
                    {downloadProgress === null ? (
                        <ActivityIndicator color={primaryColor} style={{ marginBottom: 12 }} />
                    ) : (
                        <View accessible accessibilityRole="progressbar"
                            accessibilityValue={{ min: 0, max: 100, now: downloadProgress }}
                            style={{ height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12,
                                backgroundColor: isDark ? '#333333' : '#E4E4E7' }}>
                            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                                borderRadius: 4, backgroundColor: primaryColor, width: `${downloadProgress}%` }} />
                        </View>
                    )}
                    <View className="flex-row items-center justify-between gap-3 mb-4">
                        <Text className="font-sans text-xs" style={{ color: colors.textSecondary }}>
                            {formatUpdateBytes(downloadedBytes)}{downloadTotalBytes > 0 ? ` de ${formatUpdateBytes(downloadTotalBytes)}` : ' baixados'}
                        </Text>
                        {downloadProgress !== null && <Text className="font-sans-bold text-sm" style={{ color: primaryColor }}>{downloadProgress}%</Text>}
                    </View>
                    <Text className="font-sans text-sm mb-5 leading-relaxed" style={{ color: colors.textSecondary }}>
                        {downloadStatus === 'paused' ? updateDownloadWaitingMessage(downloadReason) : 'Você pode usar outros apps. O Android continuará o download em segundo plano.'}
                    </Text>
                    <Button variant="outline" onPress={cancelDownload} className="w-full rounded-xl"><Button.Text>Cancelar download</Button.Text></Button>
                </View>
            ) : (showCheckError || downloadError) ? (
                <View className="items-center py-6">
                    <View className="p-4 rounded-full mb-5" style={{ backgroundColor: colors.bg }}>
                        <AlertCircle size={40} color={colors.textSecondary} />
                    </View>
                    <Text className="font-sans-bold text-xl text-center" style={{ color: colors.text }}>
                        {showCheckError ? 'Não foi possível verificar' : 'Atualização interrompida'}
                    </Text>
                    <Text className="font-sans text-base mt-3 mb-6 text-center leading-relaxed" style={{ color: colors.textSecondary }}>
                        {showCheckError ? checkError : downloadError}
                    </Text>
                    <Button onPress={() => { if (showCheckError) void checkForUpdates(); else if (downloadStatus === 'complete') void installDownloadedUpdate(); else void downloadAndInstall(); }} className="w-full rounded-xl">
                        <Button.Text>Tentar novamente</Button.Text>
                    </Button>
                </View>
            ) : downloadStatus === 'complete' ? (
                <View className="py-2">
                    <Text className="font-sans-bold text-xl mb-3" style={{ color: colors.text }}>Atualização pronta</Text>
                    <Text className="font-sans text-base mb-5 leading-relaxed" style={{ color: colors.textSecondary }}>
                        A versão {downloadInfo?.version} já foi baixada. Toque abaixo para instalar.
                    </Text>
                    {installMessage && <Text className="font-sans text-sm mb-5" style={{ color: colors.textSecondary }}>{installMessage}</Text>}
                    <Button onPress={installDownloadedUpdate} loading={isInstalling} className="w-full rounded-xl"><Button.Text>Instalar atualização</Button.Text></Button>
                </View>
            ) : isChecking ? (
                <View className="items-center py-6"><ActivityIndicator color={primaryColor} size="large" /><Text className="font-sans text-base mt-6 text-center" style={{ color: colors.textSecondary }}>Verificando atualizações...</Text></View>
            ) : hasUpdate ? (
                <View className="py-2">
                    <View className="flex-row items-center mb-3">
                        <RefreshCw size={24} color={primaryColor} />
                        <View style={{ width: 12 }} />
                        <Text className="font-sans-bold text-xl" style={{ color: colors.text }}>Nova versão disponível</Text>
                    </View>
                    <Text className="font-sans mb-6 text-base leading-relaxed" style={{ color: colors.textSecondary }}>
                        A versão {updateInfo?.version} está pronta para ser instalada.
                    </Text>

                    {updateInfo?.releaseNotes ? (
                        <View className="p-4 rounded-xl mb-6 border" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
                             <Text className="font-sans-bold text-sm mb-2" style={{ color: colors.text }}>Novidades:</Text>
                            <Markdown
                                style={{
                                    body: { color: colors.textSecondary, fontSize: 15, lineHeight: 22 },
                                    text: { color: colors.textSecondary },
                                    heading1: { color: colors.text, fontSize: 24, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
                                    heading2: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
                                    heading3: { color: colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
                                    heading4: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 12, marginBottom: 8 },
                                    heading5: { color: colors.text, fontSize: 15, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
                                    heading6: { color: colors.text, fontSize: 14, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
                                    paragraph: { color: colors.textSecondary, marginTop: 8, marginBottom: 8 },
                                    strong: { color: colors.text, fontWeight: 'bold' },
                                    em: { color: colors.textSecondary, fontStyle: 'italic' },
                                    link: { color: primaryColor, textDecorationLine: 'none' },
                                    list_item: { color: colors.textSecondary },
                                    bullet_list: { marginTop: 8, marginBottom: 8 },
                                    ordered_list: { marginTop: 8, marginBottom: 8 },
                                    bullet_list_icon: { color: colors.text, marginLeft: 0, marginRight: 8, marginTop: 4 },
                                    bullet_list_content: { flex: 1, color: colors.textSecondary },
                                    ordered_list_icon: { color: colors.text, marginLeft: 0, marginRight: 8, marginTop: 0 },
                                    ordered_list_content: { flex: 1, color: colors.textSecondary },
                                    blockquote: { borderLeftColor: primaryColor, borderLeftWidth: 4, paddingLeft: 12, backgroundColor: colors.surface, paddingVertical: 8, paddingRight: 8, marginVertical: 8, borderRadius: 4 },
                                    code_inline: { backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, fontFamily: 'monospace' },
                                    code_block: { backgroundColor: colors.surface, color: colors.text, padding: 12, borderRadius: 8, fontFamily: 'monospace', marginVertical: 8 },
                                    fence: { backgroundColor: colors.surface, color: colors.text, padding: 12, borderRadius: 8, fontFamily: 'monospace', marginVertical: 8 },
                                    hr: { backgroundColor: colors.border, height: 1, marginVertical: 16 },
                                    table: { borderColor: colors.border, borderWidth: 1, borderRadius: 8 },
                                    thead: { backgroundColor: colors.surface },
                                    th: { borderColor: colors.border, padding: 8, fontWeight: 'bold', color: colors.text },
                                    td: { borderColor: colors.border, padding: 8, color: colors.textSecondary },
                                }}
                            >
                                {updateInfo.releaseNotes}
                            </Markdown>
                        </View>
                    ) : null}

                    <Button variant="filled" onPress={downloadAndInstall} className="w-full py-4 rounded-xl">
                        <Button.Text className="text-base">Baixar e Instalar</Button.Text>
                    </Button>
                </View>
            ) : (
                <View className="items-center py-8">
                    <View className="p-4 rounded-full mb-6" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
                      <CheckCircle size={48} color="#10B981" />
                    </View>
                    <Text className="font-sans-bold text-xl mt-2 text-center" style={{ color: colors.text }}>O Genly está atualizado</Text>
                    <Text className="font-sans text-base mt-3 text-center leading-relaxed" style={{ color: colors.textSecondary }}>
                        Você já possui a versão mais recente instalada no seu dispositivo.
                    </Text>

                </View>
            )}
        </View>

        <View className="flex-1" />

        {/* Manual Check Button */}
        {!isRestoringDownload && !isChecking && !isDownloading && downloadStatus !== 'complete' && !hasUpdate && !checkError && !downloadError && (
             <Button variant="outline" onPress={() => { void checkForUpdates(); }} className="w-full py-4 border-2 rounded-xl" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}>
                <Button.Text className="text-base">Procurar atualizações</Button.Text>
             </Button>
        )}
      </ScrollView>
    </View>
  );
}

import { Button } from "@/components/ui/Button";
import { useTheme } from "@/providers/ThemeProvider";
import { useAppUpdateStore } from "@/store/useAppUpdateStore";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ArrowLeft, CheckCircle, RefreshCw, Smartphone } from "lucide-react-native";
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
  const downloadError = useAppUpdateStore((s) => s.downloadError);
  
  const checkForUpdates = useAppUpdateStore((s) => s.checkForUpdates);
  const downloadAndInstall = useAppUpdateStore((s) => s.downloadAndInstall);

  useEffect(() => {
    // Busca atualizações automaticamente ao abrir a tela se não estiver baixando e não tiver buscado
    if (!hasUpdate && !isDownloading && !isChecking) {
      checkForUpdates();
    }
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg, paddingTop: insets.top }}>
      
      {/* Header */}
      <View 
        className="flex-row items-center justify-between px-4 py-3 border-b" 
        style={{ borderBottomColor: colors.border }}
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
            {isChecking ? (
                <View className="items-center py-6">
                    <ActivityIndicator color={primaryColor} size="large" />
                    <Text className="font-sans text-base mt-6 text-center" style={{ color: colors.textSecondary }}>Verificando atualizações...</Text>
                </View>
            ) : isDownloading ? (
                <View className="py-2">
                    <Text className="font-sans-bold text-xl mb-3" style={{ color: colors.text }}>Baixando atualização...</Text>
                    <Text className="font-sans mb-6 text-base" style={{ color: colors.textSecondary }}>Versão {updateInfo?.version}</Text>
                    
                    {/* Progress Bar Container */}
                    <View className="h-3 rounded-full overflow-hidden w-full mb-3" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }}>
                        <View 
                            className="h-full rounded-full" 
                            style={{ backgroundColor: primaryColor, width: `${downloadProgress}%` }} 
                        />
                    </View>
                    <Text className="font-sans-bold text-right text-sm" style={{ color: primaryColor }}>{downloadProgress}%</Text>
                </View>
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

                    {downloadError ? (
                        <Text className="font-sans text-sm text-[#EF4444] mb-6 text-center bg-red-500/10 p-3 rounded-xl">{downloadError}</Text>
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
                    {downloadError ? (
                        <Text className="font-sans text-sm text-[#EF4444] mt-6 text-center bg-red-500/10 p-3 rounded-xl">{downloadError}</Text>
                    ) : null}
                </View>
            )}
        </View>
        
        <View className="flex-1" />

        {/* Manual Check Button */}
        {!isChecking && !isDownloading && !hasUpdate && (
             <Button variant="outline" onPress={checkForUpdates} className="w-full py-4 border-2 rounded-xl" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}>
                <Button.Text className="text-base">Procurar atualizações</Button.Text>
             </Button>
        )}
      </ScrollView>
    </View>
  );
}

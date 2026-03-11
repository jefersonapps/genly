import { Dialog } from "@/components/ui/Dialog";
import { useTheme } from "@/providers/ThemeProvider";
import { getSetting } from "@/services/settingsService";
import { useAppUpdateStore } from "@/store/useAppUpdateStore";
import { usePathname, useRouter } from "expo-router";
import { AlertCircle, Download } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import Markdown from 'react-native-markdown-renderer';

export function InAppUpdateDialog() {
  const { primaryColor } = useTheme();
  
  const hasUpdate = useAppUpdateStore((s) => s.hasUpdate);
  const updateInfo = useAppUpdateStore((s) => s.updateInfo);
  const downloadError = useAppUpdateStore((s) => s.downloadError);
  const downloadAndInstall = useAppUpdateStore((s) => s.downloadAndInstall);
  const checkUpdates = useAppUpdateStore((s) => s.checkForUpdates);

  // We use our own local state to control the dialog visibility,
  // since 'hasUpdate' in the store persists, we don't want to trap the user
  const [visible, setVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  
  const isDark = resolvedTheme === "dark";
  const colors = {
    surface: isDark ? "#171717" : "#F5F5F5",
    text: isDark ? "#FAFAFA" : "#18181B",
    textSecondary: isDark ? "#A1A1AA" : "#71717A",
    border: isDark ? "#262626" : "#E5E5E5",
  };

  const hasShownRef = useRef(false);

  useEffect(() => {
    // Only auto-show if we have an update, the user has finished onboarding,
    // and we haven't already shown the dialog in this session.
    const checkOnboardingAndShow = async () => {
      if (hasUpdate && updateInfo && !hasShownRef.current) {
        const onboardingStatus = await getSetting("has_completed_onboarding");
        if (onboardingStatus === "1") {
          hasShownRef.current = true;
          setVisible(true);
        }
      }
    };
    
    checkOnboardingAndShow();
  }, [hasUpdate, updateInfo, pathname]);

  useEffect(() => {
     if (downloadError) {
        setErrorVisible(true);
     }
  }, [downloadError]);

  const handleUpdate = () => {
    setVisible(false);
    if (pathname !== "/settings/updates") {
      router.push("/settings/updates");
    }
    // Small delay to allow navigation transition to start before blocking the thread with download initialization
    setTimeout(() => {
      downloadAndInstall();
    }, 150);
  };

  const handleLater = () => {
    setVisible(false);
  };

  const handleRetryError = () => {
      setErrorVisible(false);
      downloadAndInstall();
  };

  const handleCloseError = () => {
      setErrorVisible(false);
  };

  return (
    <>
      {/* UPDATE DIALOG */}
      <Dialog visible={visible} onClose={handleLater}>
        <Dialog.Header>
          <Dialog.Title icon={<Download color={primaryColor} size={24} />}>
            Atualização Disponível
          </Dialog.Title>
          <Dialog.Description>
            {`A versão ${updateInfo?.version || "mais recente"} do Genly está disponível! Gostaria de baixar e instalar a nova versão agora? O download acontecerá em segundo plano.`}
          </Dialog.Description>
          
          {updateInfo?.releaseNotes ? (
             <View className="bg-surface-secondary p-3 rounded-xl mb-4" style={{ maxHeight: 240 }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} style={{ flexGrow: 0 }}>
                  <Markdown 
                      style={{ 
                          body: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
                          text: { color: colors.textSecondary },
                          heading1: { color: colors.text, fontSize: 20, fontWeight: 'bold', marginTop: 12, marginBottom: 6 },
                          heading2: { color: colors.text, fontSize: 18, fontWeight: 'bold', marginTop: 12, marginBottom: 6 },
                          heading3: { color: colors.text, fontSize: 16, fontWeight: 'bold', marginTop: 10, marginBottom: 4 },
                          heading4: { color: colors.text, fontSize: 15, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
                          heading5: { color: colors.text, fontSize: 14, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
                          heading6: { color: colors.text, fontSize: 14, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
                          paragraph: { color: colors.textSecondary, marginTop: 4, marginBottom: 4 },
                          strong: { color: colors.text, fontWeight: 'bold' },
                          em: { color: colors.textSecondary, fontStyle: 'italic' },
                          link: { color: primaryColor, textDecorationLine: 'none' },
                          list_item: { color: colors.textSecondary },
                          bullet_list: { marginTop: 4, marginBottom: 4 },
                          ordered_list: { marginTop: 4, marginBottom: 4 },
                          bullet_list_icon: { color: colors.text, marginLeft: 0, marginRight: 6, marginTop: 4 },
                          bullet_list_content: { flex: 1, color: colors.textSecondary },
                          ordered_list_icon: { color: colors.text, marginLeft: 0, marginRight: 6, marginTop: 0 },
                          ordered_list_content: { flex: 1, color: colors.textSecondary },
                          blockquote: { borderLeftColor: primaryColor, borderLeftWidth: 3, paddingLeft: 10, backgroundColor: colors.surface, paddingVertical: 6, paddingRight: 6, marginVertical: 6, borderRadius: 4 },
                          code_inline: { backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4, fontFamily: 'monospace', fontSize: 12 },
                          code_block: { backgroundColor: colors.surface, color: colors.text, padding: 8, borderRadius: 6, fontFamily: 'monospace', marginVertical: 6, fontSize: 12 },
                          fence: { backgroundColor: colors.surface, color: colors.text, padding: 8, borderRadius: 6, fontFamily: 'monospace', marginVertical: 6, fontSize: 12 },
                          hr: { backgroundColor: colors.border, height: 1, marginVertical: 12 },
                          table: { borderColor: colors.border, borderWidth: 1, borderRadius: 6 },
                          thead: { backgroundColor: colors.surface },
                          th: { borderColor: colors.border, padding: 6, fontWeight: 'bold', color: colors.text, fontSize: 12 },
                          td: { borderColor: colors.border, padding: 6, color: colors.textSecondary, fontSize: 12 },
                      }}
                  >
                      {updateInfo.releaseNotes}
                  </Markdown>
                </ScrollView>
             </View>
          ) : null}

        </Dialog.Header>
        <Dialog.Footer>
          <Dialog.Button variant="ghost" onPress={handleLater}>
            Lembrar depois
          </Dialog.Button>
          <Dialog.Button variant="default" onPress={handleUpdate}>
            Atualizar Agora
          </Dialog.Button>
        </Dialog.Footer>
      </Dialog>

      {/* ERROR DIALOG */}
      <Dialog visible={errorVisible} onClose={handleCloseError}>
        <Dialog.Header>
           <Dialog.Title icon={<AlertCircle color="#EF4444" size={24} />}>
               Falha na Atualização
           </Dialog.Title>
           <Dialog.Description>
               {downloadError || "Ocorreu um erro ao tentar baixar a atualização. O arquivo pode estar corrompido ou houve perda de conexão."}
           </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
           <Dialog.Button variant="ghost" onPress={handleCloseError}>
               Cancelar
           </Dialog.Button>
           <Dialog.Button variant="default" onPress={handleRetryError}>
               Tentar Novamente
           </Dialog.Button>
        </Dialog.Footer>
      </Dialog>
    </>
  );
}
